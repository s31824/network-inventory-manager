"""Database tables.

Privacy rule: no hostnames, serial numbers, IP addresses, street addresses,
Meraki networks or contract data are stored. Only what the cost module needs.
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


Money = Numeric(12, 2)


class Import(Base):
    """One monthly inventory file. Re-importing a month replaces it."""
    __tablename__ = "imports"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_month: Mapped[str] = mapped_column(String(7), unique=True)  # "2026-10"
    file_name: Mapped[str] = mapped_column(String(255))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    rows_read: Mapped[int] = mapped_column(Integer)
    device_count: Mapped[int] = mapped_column(Integer)

    device_counts: Mapped[list["DeviceCount"]] = relationship(
        back_populates="import_", cascade="all, delete-orphan"
    )


class Location(Base):
    """A site. Only code, city, country and category are kept (no street address)."""
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)  # "SE0029"
    city: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[str | None] = mapped_column(String(50))  # Bronze, Gold, ...


class DeviceCount(Base):
    """Aggregated devices: how many of one model sit in one location in one monthly file."""
    __tablename__ = "device_counts"
    __table_args__ = (
        UniqueConstraint("import_id", "location_id", "model", "device_type", "eos_date",
                         name="uq_device_count"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    import_id: Mapped[int] = mapped_column(ForeignKey("imports.id", ondelete="CASCADE"), index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), index=True)
    model: Mapped[str] = mapped_column(String(100), index=True)
    device_type: Mapped[str] = mapped_column(String(100))  # as in the file, e.g. "WAP"
    eos_date: Mapped[date | None] = mapped_column(Date)    # None = no End of Support declared
    count: Mapped[int] = mapped_column(Integer)

    import_: Mapped[Import] = relationship(back_populates="device_counts")
    location: Mapped[Location] = relationship()


class ModelCost(Base):
    """Price list: the costs of one model (its own costs, not its replacement's)."""
    __tablename__ = "model_costs"

    id: Mapped[int] = mapped_column(primary_key=True)
    model: Mapped[str] = mapped_column(String(100), unique=True)
    vendor: Mapped[str | None] = mapped_column(String(100))
    device_type: Mapped[str | None] = mapped_column(String(100))
    hardware_price: Mapped[Decimal | None] = mapped_column(Money)
    installation_cost: Mapped[Decimal | None] = mapped_column(Money)
    licence_per_year: Mapped[Decimal | None] = mapped_column(Money)
    support_per_year: Mapped[Decimal | None] = mapped_column(Money)
    replacement_model: Mapped[str | None] = mapped_column(String(100))  # another row's model
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    price_date: Mapped[str | None] = mapped_column(String(7))  # "2026-10"
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class LocationPlan(Base):
    """Replacement plan of one location for one End of Support year."""
    __tablename__ = "location_plans"
    __table_args__ = (UniqueConstraint("location_id", "year", name="uq_location_plan"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="Not planned")
    planned_month: Mapped[str | None] = mapped_column(String(7))  # "2026-12"
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class LocationModelPlan(Base):
    """Per-model changes inside a location plan: devices to decommission and/or a
    different replacement model than the price list suggests. A row exists only
    when something differs from the default."""
    __tablename__ = "location_model_plans"
    __table_args__ = (UniqueConstraint("location_id", "year", "model", name="uq_location_model_plan"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    model: Mapped[str] = mapped_column(String(100))
    decommission_count: Mapped[int] = mapped_column(Integer, default=0)
    replacement_model: Mapped[str | None] = mapped_column(String(100))  # None = use price list
