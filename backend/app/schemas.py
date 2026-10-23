"""Request and response shapes (validated by Pydantic)."""
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Model names like "MR33", "WS-C3650-24PS-S", "WS-C2960+48TC-S", "N9K-C93180YC-EX=", "ISR4331-SEC/K9"
ModelName = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9][A-Za-z0-9 ._+/=-]*$")]
Price = Annotated[Decimal, Field(ge=0, le=10_000_000, max_digits=12, decimal_places=2)]
Currency = Annotated[str, Field(pattern=r"^(EUR|SEK|DKK|NOK|USD|GBP|PLN)$")]
Month = Annotated[str, Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")]  # "2026-10"


class ModelCostBase(BaseModel):
    vendor: str | None = Field(default=None, max_length=100)
    device_type: str | None = Field(default=None, max_length=100)
    hardware_price: Price | None = None
    installation_cost: Price | None = None
    licence_per_year: Price | None = None
    support_per_year: Price | None = None
    replacement_model: ModelName | None = None
    currency: Currency = "EUR"
    price_date: Month | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("vendor", "device_type", "notes", "replacement_model")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class ModelCostCreate(ModelCostBase):
    model: ModelName

    @field_validator("model")
    @classmethod
    def strip_model(cls, v: str) -> str:
        return v.strip()


class ModelCostUpdate(ModelCostBase):
    """Full update of one price list row (the model name itself cannot change)."""


class ModelCostOut(ModelCostBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    model: str
    ownership_per_year: Decimal
    created_at: datetime
    updated_at: datetime
