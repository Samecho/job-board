from datetime import UTC, date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    domain: Mapped[str] = mapped_column(String(180))
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tier: Mapped[str] = mapped_column(String(2), default="B")
    category: Mapped[str] = mapped_column(String(80), index=True)
    career_url: Mapped[str] = mapped_column(String(500))
    main_locations: Mapped[str] = mapped_column(Text, default="")
    intern_open_count: Mapped[int] = mapped_column(Integer, default=0)
    is_intern_hiring: Mapped[bool] = mapped_column(Boolean, default=False)
    average_intern_pay_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    average_intern_pay_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    pay_currency: Mapped[str] = mapped_column(String(8), default="USD")
    pay_period: Mapped[str] = mapped_column(String(16), default="unknown")
    match_score: Mapped[int] = mapped_column(Integer, default=50)
    application_status: Mapped[str] = mapped_column(String(24), default="Not Applied")
    notes: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(Text, default="")
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    jobs: Mapped[list["Job"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200), default="")
    job_type: Mapped[str] = mapped_column(String(30), default="Internship")
    apply_url: Mapped[str] = mapped_column(String(500), default="")
    salary_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    pay_period: Mapped[str] = mapped_column(String(16), default="unknown")
    status: Mapped[str] = mapped_column(String(30), default="Open")
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    date_added: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    company: Mapped[Company] = relationship(back_populates="jobs")
