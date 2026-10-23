"""Read helpers: latest import rows joined with locations, price list and plans."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DeviceCount, Import, Location, LocationModelPlan, LocationPlan, ModelCost
from app.services.rules import device_category

ZERO = Decimal(0)


@dataclass
class Row:
    location_code: str
    city: str
    country: str
    loc_category: str | None
    model: str
    device_type: str
    category: str
    eos_date: date | None
    count: int


def latest_import(db: Session) -> Import | None:
    return db.scalar(select(Import).order_by(Import.report_month.desc()).limit(1))


def load_rows(db: Session, country: str | None = None, category: str | None = None) -> list[Row]:
    imp = latest_import(db)
    if imp is None:
        return []
    q = (select(DeviceCount, Location).join(Location, DeviceCount.location_id == Location.id)
         .where(DeviceCount.import_id == imp.id))
    if country:
        q = q.where(Location.country == country)
    rows = [Row(loc.code, loc.city, loc.country, loc.category, dc.model, dc.device_type,
                device_category(dc.device_type), dc.eos_date, dc.count)
            for dc, loc in db.execute(q).all()]
    if category:
        rows = [r for r in rows if r.category == category]
    return rows


def price_list(db: Session) -> dict[str, ModelCost]:
    return {m.model: m for m in db.scalars(select(ModelCost))}


def plans(db: Session, year: int) -> tuple[dict[str, LocationPlan], dict[tuple[str, str], LocationModelPlan]]:
    loc_plans = {code: p for p, code in db.execute(
        select(LocationPlan, Location.code).join(Location, LocationPlan.location_id == Location.id)
        .where(LocationPlan.year == year)).all()}
    model_plans = {(code, p.model): p for p, code in db.execute(
        select(LocationModelPlan, Location.code).join(Location, LocationModelPlan.location_id == Location.id)
        .where(LocationModelPlan.year == year)).all()}
    return loc_plans, model_plans


def replacement_for(model: str, prices: dict[str, ModelCost], override: str | None = None) -> str | None:
    if override:
        return override
    m = prices.get(model)
    return m.replacement_model if m else None


def replacement_unit_cost(replacement: str | None, prices: dict[str, ModelCost]) -> Decimal | None:
    """Hardware + installation of the replacement model, or None when unknown."""
    if not replacement or replacement not in prices:
        return None
    r = prices[replacement]
    if r.hardware_price is None:
        return None
    return r.hardware_price + (r.installation_cost or ZERO)


def ownership_unit_cost(model: str, prices: dict[str, ModelCost]) -> Decimal | None:
    m = prices.get(model)
    if m is None or (m.licence_per_year is None and m.support_per_year is None):
        return None
    return (m.licence_per_year or ZERO) + (m.support_per_year or ZERO)
