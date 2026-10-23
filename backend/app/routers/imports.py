"""Monthly import API: receives aggregated counts, never raw inventory rows."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DeviceCount, Import, Location
from app.schemas_import import ImportOut, ImportRequest

router = APIRouter(prefix="/api/imports", tags=["Imports"])


@router.get("", response_model=list[ImportOut])
def list_imports(db: Session = Depends(get_db)):
    return db.scalars(select(Import).order_by(Import.report_month.desc())).all()


@router.post("", response_model=ImportOut, status_code=status.HTTP_201_CREATED)
def create_import(data: ImportRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(Import).where(Import.report_month == data.report_month))
    if existing is not None:
        if not data.replace:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"{data.report_month} is already imported. Send replace=true to overwrite it.")
        db.delete(existing)  # cascade removes its device_counts
        db.flush()

    # Upsert locations: keep the latest city/country/category from the newest file.
    by_code = {loc.code: loc for loc in db.scalars(
        select(Location).where(Location.code.in_([l.code for l in data.locations]))
    )}
    for item in data.locations:
        loc = by_code.get(item.code)
        if loc is None:
            loc = Location(code=item.code)
            db.add(loc)
            by_code[item.code] = loc
        loc.city, loc.country, loc.category = item.city, item.country, item.category
    db.flush()  # assigns ids to new locations

    imp = Import(report_month=data.report_month, file_name=data.file_name, rows_read=data.rows_read,
                 device_count=sum(d.count for d in data.device_counts))
    db.add(imp)
    db.flush()
    db.add_all(DeviceCount(import_id=imp.id, location_id=by_code[d.location_code].id, model=d.model,
                           device_type=d.device_type, eos_date=d.eos_date, count=d.count)
               for d in data.device_counts)
    db.commit()
    db.refresh(imp)
    return imp


@router.delete("/{report_month}", status_code=status.HTTP_204_NO_CONTENT)
def delete_import(report_month: str, db: Session = Depends(get_db)):
    imp = db.scalar(select(Import).where(Import.report_month == report_month))
    if imp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No import for {report_month}.")
    db.delete(imp)
    db.commit()
