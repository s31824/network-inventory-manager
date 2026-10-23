"""Price list API: the costs of each device model."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ModelCost
from app.schemas import ModelCostCreate, ModelCostOut, ModelCostUpdate

router = APIRouter(prefix="/api/model-costs", tags=["Price list"])


def to_out(row: ModelCost) -> ModelCostOut:
    ownership = (row.licence_per_year or Decimal(0)) + (row.support_per_year or Decimal(0))
    return ModelCostOut.model_validate({**row.__dict__, "ownership_per_year": ownership})


def get_or_404(db: Session, model: str) -> ModelCost:
    row = db.scalar(select(ModelCost).where(ModelCost.model == model))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Model '{model}' is not in the price list.")
    return row


def check_replacement(db: Session, model: str, replacement: str | None) -> None:
    if replacement is None:
        return
    if replacement == model:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A model cannot replace itself.")
    if db.scalar(select(ModelCost.id).where(ModelCost.model == replacement)) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Replacement '{replacement}' is not in the price list. Add it first.")


@router.get("", response_model=list[ModelCostOut])
def list_model_costs(db: Session = Depends(get_db)):
    rows = db.scalars(select(ModelCost).order_by(ModelCost.model)).all()
    return [to_out(r) for r in rows]


@router.get("/{model}", response_model=ModelCostOut)
def get_model_cost(model: str, db: Session = Depends(get_db)):
    return to_out(get_or_404(db, model))


@router.post("", response_model=ModelCostOut, status_code=status.HTTP_201_CREATED)
def create_model_cost(data: ModelCostCreate, db: Session = Depends(get_db)):
    if db.scalar(select(ModelCost.id).where(ModelCost.model == data.model)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Model '{data.model}' is already in the price list. Edit it instead.")
    check_replacement(db, data.model, data.replacement_model)
    row = ModelCost(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_out(row)


@router.put("/{model}", response_model=ModelCostOut)
def update_model_cost(model: str, data: ModelCostUpdate, db: Session = Depends(get_db)):
    row = get_or_404(db, model)
    check_replacement(db, model, data.replacement_model)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return to_out(row)


@router.delete("/{model}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model_cost(model: str, db: Session = Depends(get_db)):
    row = get_or_404(db, model)
    used_by = db.scalars(select(ModelCost.model).where(ModelCost.replacement_model == model)).all()
    if used_by:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"'{model}' is the replacement for {', '.join(used_by)}. Change those first.")
    db.delete(row)
    db.commit()
