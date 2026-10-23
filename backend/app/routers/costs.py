"""Costs: replacement cost by End of Support year and yearly ownership cost.

year="all"  -> full replacement cost per EOS year (next 5 years), no plan logic
year=2026   -> plan logic: already planned / not planned / avoided by decommission
"""
from collections import defaultdict
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import inventory as inv
from app.services.rules import CATEGORIES, EXCLUDED_STATUSES, PLANNED_STATUSES

router = APIRouter(prefix="/api/costs", tags=["Costs"])
ZERO = Decimal(0)


def ownership(rows, prices, group_key):
    groups = defaultdict(lambda: {"label": "", "licences": ZERO, "support": ZERO, "devices": 0})
    lic_total = sup_total = ZERO
    missing = 0
    for r in rows:
        m = prices.get(r.model)
        if m is None or (m.licence_per_year is None and m.support_per_year is None):
            missing += r.count
            continue
        lic, sup = (m.licence_per_year or ZERO) * r.count, (m.support_per_year or ZERO) * r.count
        g = groups[group_key(r)]
        g["label"] = group_key(r)
        g["licences"] += lic
        g["support"] += sup
        g["devices"] += r.count
        lic_total += lic
        sup_total += sup
    by_group = sorted(groups.values(), key=lambda g: -(g["licences"] + g["support"]))
    return {"total": lic_total + sup_total, "licences": lic_total, "support": sup_total,
            "devices": sum(r.count for r in rows), "devices_without_price": missing, "by_group": by_group}


@router.get("")
def costs(year: Annotated[str, Query(pattern=r"^(all|20\d{2})$")] = "all",
          country: str | None = None,
          device_category: str | None = None,
          db: Session = Depends(get_db)):
    if device_category and device_category not in CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"device_category must be one of {CATEGORIES}")
    imp = inv.latest_import(db)
    rows = inv.load_rows(db, country=country, category=device_category)
    prices = inv.price_list(db)
    group_key = (lambda r: r.city) if country else (lambda r: r.country)
    result = {"report_month": imp.report_month if imp else None, "year": year, "country": country,
              "device_category": device_category, "group_by": "city" if country else "country",
              "ownership": ownership(rows, prices, group_key)}

    if year == "all":
        first = int(imp.report_month[:4]) if imp else 2026
        years = list(range(first, first + 5))
        by_year = {y: {"year": y, "hardware": ZERO, "installation": ZERO, "devices": 0, "without_price": 0}
                   for y in years}
        by_model = {}
        for r in rows:
            if not r.eos_date or r.eos_date.year not in by_year:
                continue
            y = by_year[r.eos_date.year]
            y["devices"] += r.count
            repl = inv.replacement_for(r.model, prices)
            rp = prices.get(repl) if repl else None
            m = by_model.setdefault(r.model, {"model": r.model, "category": r.category,
                                              "eos_year": r.eos_date.year, "devices": 0,
                                              "unit_cost": inv.replacement_unit_cost(repl, prices),
                                              "total": ZERO})
            m["devices"] += r.count
            if rp is None or rp.hardware_price is None:
                y["without_price"] += r.count
                continue
            y["hardware"] += rp.hardware_price * r.count
            y["installation"] += (rp.installation_cost or ZERO) * r.count
            m["total"] += m["unit_cost"] * r.count
        total = sum(y["hardware"] + y["installation"] for y in by_year.values())
        result["replacement"] = {"total": total, "years": list(by_year.values()),
                                 "by_model": sorted(by_model.values(), key=lambda m: -m["total"])}
        return result

    y = int(year)
    loc_plans, model_plans = inv.plans(db, y)
    tiles = {k: ZERO for k in ("full", "planned", "not_planned", "avoided", "excluded")}
    counts = {k: 0 for k in tiles}
    groups = defaultdict(lambda: {"label": "", "full": ZERO, "planned": ZERO})
    by_model = {}
    for r in rows:
        if not r.eos_date or r.eos_date.year != y:
            continue
        lp = loc_plans.get(r.location_code)
        st = lp.status if lp else "Not planned"
        mp = model_plans.get((r.location_code, r.model))
        unit = inv.replacement_unit_cost(
            inv.replacement_for(r.model, prices, mp.replacement_model if mp else None), prices) or ZERO
        decom = r.count if st == "Decommission" else min(mp.decommission_count, r.count) if mp else 0
        rest = r.count - decom
        bucket = "planned" if st in PLANNED_STATUSES else "excluded" if st in EXCLUDED_STATUSES else \
                 "avoided" if st == "Decommission" else "not_planned"
        tiles["full"] += unit * r.count
        counts["full"] += r.count
        tiles["avoided"] += unit * decom
        counts["avoided"] += decom
        if bucket != "avoided":
            tiles[bucket] += unit * rest
            counts[bucket] += rest
        g = groups[group_key(r)]
        g["label"] = group_key(r)
        g["full"] += unit * r.count
        if bucket == "planned":
            g["planned"] += unit * rest
        m = by_model.setdefault(r.model, {"model": r.model, "category": r.category, "devices": 0,
                                          "planned": 0, "decommission": 0, "unit_cost": unit or None,
                                          "planned_cost": ZERO})
        m["devices"] += r.count
        m["decommission"] += decom
        if bucket == "planned":
            m["planned"] += rest
            m["planned_cost"] += unit * rest
    result["plan"] = {"tiles": tiles, "devices": counts,
                      "by_group": sorted(groups.values(), key=lambda g: -g["full"]),
                      "by_model": sorted(by_model.values(), key=lambda m: (-m["planned_cost"], -m["devices"]))}
    return result
