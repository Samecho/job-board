from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    parent_company: Mapped[str | None] = mapped_column(String(120), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(180), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    career_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tier: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    company_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    main_locations: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    global_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    intern_friendly: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="Not Applied", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    resumes: Mapped[list["GeneratedResume"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )


class ResumeProfile(Base):
    __tablename__ = "resume_profile"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    education_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    projects_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    awards_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    other_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class GeneratedResume(Base):
    __tablename__ = "generated_resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    job_title: Mapped[str | None] = mapped_column(String(240), nullable=True)
    jd_text: Mapped[str] = mapped_column(Text)
    generated_latex: Mapped[str] = mapped_column(Text)
    resume_name: Mapped[str] = mapped_column(String(240))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    company: Mapped[Company] = relationship(back_populates="resumes")
