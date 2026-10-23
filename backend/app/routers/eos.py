"""End of Support planning: which locations have devices reaching EOS in a year, and their plans."""
from collections import defaultdict
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Location, LocationModelPlan, LocationPlan, ModelCost
from app.services import inventory as inv
from app.services.rules import LOCATION_STATUSES

router = APIRouter(prefix="/api/eos", tags=["End of Support"])

Year = Annotated[int, Field(ge=2000, le=2100)]
Month = Annotated[str, Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")]


class ModelLine(BaseModel):
    model: str
    device_type: str
    category: str
    eos_date: str | None
    devices: int
    decommission: int
    to_replace: int
    replacement_model: str | None
    replacement_is_default: bool
    replacement_unit_cost: Decimal | None
    replacement_cost: Decimal | None


class LocationLine(BaseModel):
    code: str
    city: str
    country: str
    category: str | None
    status: str
    planned_month: str | None
    devices: int
    models: list[ModelLine]


class EosOut(BaseModel):
    year: int
    devices: int
    locations: list[LocationLine]
    models_reaching_eos: dict[str, int]


class LocationPlanIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal[tuple(LOCATION_STATUSES)]  # type: ignore[valid-type]
    planned_month: Month | None = None


class ModelPlanIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decommission_count: Annotated[int, Field(ge=0, le=100_000)] = 0
    replacement_model: Annotated[str, Field(max_length=100)] | None = None  # None = use price list


@router.get("", response_model=EosOut)
def eos_overview(year: Annotated[int, Query(ge=2000, le=2100)],
                 country: str | None = None, city: str | None = None,
                 db: Session = Depends(get_db)):
    rows = [r for r in inv.load_rows(db, country=country)
            if r.eos_date and r.eos_date.year == year and (not city or r.city == city)]
    prices = inv.price_list(db)
    loc_plans, model_plans = inv.plans(db, year)

    by_loc: dict[str, list[inv.Row]] = defaultdict(list)
    for r in rows:
        by_loc[r.location_code].append(r)

    locations, model_totals = [], defaultdict(int)
    for code, items in sorted(by_loc.items(), key=lambda kv: (kv[1][0].city, kv[0])):
        lp = loc_plans.get(code)
        lines = []
        for r in sorted(items, key=lambda x: x.model):
            mp = model_plans.get((code, r.model))
            decom = min(mp.decommission_count, r.count) if mp else 0
            repl = inv.replacement_for(r.model, prices, mp.replacement_model if mp else None)
            unit = inv.replacement_unit_cost(repl, prices)
            to_replace = r.count - decom
            lines.append(ModelLine(
                model=r.model, device_type=r.device_type, category=r.category,
                eos_date=r.eos_date.isoformat(), devices=r.count, decommission=decom, to_replace=to_replace,
                replacement_model=repl, replacement_is_default=not (mp and mp.replacement_model),
                replacement_unit_cost=unit, replacement_cost=unit * to_replace if unit is not None else None))
            model_totals[r.model] += r.count
        locations.append(LocationLine(
            code=code, city=items[0].city, country=items[0].country, category=items[0].loc_category,
            status=lp.status if lp else "Not planned", planned_month=lp.planned_month if lp else None,
            devices=sum(i.count for i in items), models=lines))
    return EosOut(year=year, devices=sum(model_totals.values()), locations=locations,
                  models_reaching_eos=dict(sorted(model_totals.items(), key=lambda kv: -kv[1])))


def _location(db: Session, code: str) -> Location:
    loc = db.scalar(select(Location).where(Location.code == code))
    if loc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Location '{code}' not found.")
    return loc


@router.put("/{year}/locations/{code}", response_model=LocationPlanIn)
def set_location_plan(year: Annotated[int, Field(ge=2000, le=2100)], code: str, data: LocationPlanIn,
                      db: Session = Depends(get_db)):
    loc = _location(db, code)
    plan = db.scalar(select(LocationPlan).where(LocationPlan.location_id == loc.id, LocationPlan.year == year))
    if plan is None:
        plan = LocationPlan(location_id=loc.id, year=year)
        db.add(plan)
    plan.status = data.status
    plan.planned_month = None if data.status in ("Not planned", "Out of scope") else data.planned_month
    db.commit()
    return LocationPlanIn(status=plan.status, planned_month=plan.planned_month)


@router.put("/{year}/locations/{code}/models/{model}", response_model=ModelPlanIn)
def set_model_plan(year: Annotated[int, Field(ge=2000, le=2100)], code: str, model: str, data: ModelPlanIn,
                   db: Session = Depends(get_db)):
    loc = _location(db, code)
    if data.replacement_model and db.scalar(
            select(ModelCost.id).where(ModelCost.model == data.replacement_model)) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Replacement '{data.replacement_model}' is not in the price list.")
    mp = db.scalar(select(LocationModelPlan).where(LocationModelPlan.location_id == loc.id,
                                                   LocationModelPlan.year == year,
                                                   LocationModelPlan.model == model))
    is_default = data.decommission_count == 0 and not data.replacement_model
    if is_default:
        if mp is not None:   # back to default: no row needed
            db.delete(mp)
    else:
        if mp is None:
            mp = LocationModelPlan(location_id=loc.id, year=year, model=model)
            db.add(mp)
        mp.decommission_count = data.decommission_count
        mp.replacement_model = data.replacement_model
    db.commit()
    return data
