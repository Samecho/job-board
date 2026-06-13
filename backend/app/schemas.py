from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


STATUSES = ["Not Applied", "Applied"]


class CompanyRead(BaseModel):
    id: int
    name: str
    display_name: str | None
    domain: str
    logo_url: str | None
    career_url: str
    tier: str
    category: str
    main_locations: str
    status: str
    notes: str
    link: str
    resume_count: int = 0


class CompanyUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    link: str | None = Field(default=None, max_length=1000)
    main_locations: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is not None and value not in STATUSES:
            raise ValueError("Invalid company status")
        return value


class ResumeProfileBase(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    website: str = ""
    education_text: str = ""
    experience_text: str = ""
    projects_text: str = ""
    skills_text: str = ""
    awards_text: str = ""
    other_text: str = ""


class ResumeProfileRead(ResumeProfileBase):
    id: int
    updated_at: datetime


class ResumeGenerateRequest(BaseModel):
    company_id: int
    job_title: str = ""
    jd_text: str = Field(min_length=20)
    extra_instructions: str = ""


class ResumeGenerateResponse(BaseModel):
    generated_latex: str
    suggested_resume_name: str
    warnings: list[str] = Field(default_factory=list)


class GeneratedResumeBase(BaseModel):
    job_title: str = ""
    jd_text: str = Field(min_length=1)
    generated_latex: str = Field(min_length=1)
    resume_name: str = Field(min_length=1, max_length=240)
    notes: str = ""


class GeneratedResumeUpdate(BaseModel):
    job_title: str | None = None
    jd_text: str | None = Field(default=None, min_length=1)
    generated_latex: str | None = Field(default=None, min_length=1)
    resume_name: str | None = Field(default=None, min_length=1, max_length=240)
    notes: str | None = None


class GeneratedResumeRead(GeneratedResumeBase):
    id: int
    company_id: int
    company_name: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RecentResume(BaseModel):
    id: int
    company_id: int
    company_name: str
    resume_name: str
    job_title: str
    created_at: datetime


class AnalyticsSummary(BaseModel):
    total_companies: int
    applied_count: int
    status_counts: dict[str, int]
    tier_counts: dict[str, int]
    saved_resume_count: int
    companies_with_resumes: int
    recent_resumes: list[RecentResume]


class FeatureStatus(BaseModel):
    ai_enabled: bool
    ai_configured: bool
