"""Shapes for the monthly import.

The browser reads the Excel file and sends ONLY these aggregated numbers.
Unknown fields are rejected (extra="forbid"), so hostnames, serial numbers,
IP addresses or street addresses can never be stored, even by mistake.
"""
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

Month = Annotated[str, Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")]
Code = Annotated[str, Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")]
Text = Annotated[str, Field(min_length=1, max_length=100)]
ModelName = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9][A-Za-z0-9 ._+/=()-]*$")]

MAX_LOCATIONS = 5_000
MAX_COUNT_ROWS = 50_000


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ImportLocation(Strict):
    code: Code
    city: Text
    country: Text
    category: Annotated[str, Field(max_length=50)] | None = None


class ImportDeviceCount(Strict):
    location_code: Code
    model: ModelName
    device_type: Text
    eos_date: date | None = None  # None = "No LDOS declared" or empty
    count: Annotated[int, Field(ge=1, le=100_000)]


class ImportRequest(Strict):
    report_month: Month
    file_name: Annotated[str, Field(min_length=1, max_length=255)]
    rows_read: Annotated[int, Field(ge=0, le=1_000_000)]
    replace: bool = False  # must be true to overwrite an existing month
    locations: Annotated[list[ImportLocation], Field(min_length=1, max_length=MAX_LOCATIONS)]
    device_counts: Annotated[list[ImportDeviceCount], Field(min_length=1, max_length=MAX_COUNT_ROWS)]

    @model_validator(mode="after")
    def check_consistency(self):
        codes = [loc.code for loc in self.locations]
        if len(codes) != len(set(codes)):
            raise ValueError("Each location code may appear only once in 'locations'.")
        known = set(codes)
        unknown = sorted({dc.location_code for dc in self.device_counts} - known)
        if unknown:
            raise ValueError(f"Unknown location codes in device_counts: {', '.join(unknown[:10])}")
        keys = [(d.location_code, d.model, d.device_type, d.eos_date) for d in self.device_counts]
        if len(keys) != len(set(keys)):
            raise ValueError("device_counts must be aggregated: each location/model/type/EOS date once.")
        return self


class ImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_month: str
    file_name: str
    imported_at: datetime
    rows_read: int
    device_count: int
