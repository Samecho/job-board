from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


APPLICATION_STATUSES = [
    "Not Applied", "Watching", "Interested", "Applied", "OA",
    "Interview", "Rejected", "Offer", "Hidden",
]


class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    domain: str = ""
    logo_url: str | None = None
    tier: str = Field(default="B", pattern=r"^(S\+|S|A\+|A|B\+|B|C\+|C|D\+|D)$")
    category: str = "Other"
    career_url: str = ""
    main_locations: str = ""
    intern_open_count: int = Field(default=0, ge=0)
    is_intern_hiring: bool = False
    average_intern_pay_min: float | None = Field(default=None, ge=0)
    average_intern_pay_max: float | None = Field(default=None, ge=0)
    pay_currency: str = "USD"
    pay_period: str = "unknown"
    match_score: int = Field(default=50, ge=0, le=100)
    application_status: str = "Not Applied"
    notes: str = ""
    tags: str = ""


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    logo_url: str | None = None
    tier: str | None = Field(default=None, pattern=r"^(S\+|S|A\+|A|B\+|B|C\+|C|D\+|D)$")
    category: str | None = None
    career_url: str | None = None
    main_locations: str | None = None
    intern_open_count: int | None = Field(default=None, ge=0)
    is_intern_hiring: bool | None = None
    average_intern_pay_min: float | None = Field(default=None, ge=0)
    average_intern_pay_max: float | None = Field(default=None, ge=0)
    pay_currency: str | None = None
    pay_period: str | None = None
    match_score: int | None = Field(default=None, ge=0, le=100)
    application_status: str | None = None
    notes: str | None = None
    tags: str | None = None


class CompanyRead(CompanyBase):
    id: int
    last_updated: datetime
    model_config = ConfigDict(from_attributes=True)


class JobBase(BaseModel):
    company_id: int
    title: str = Field(min_length=1, max_length=200)
    location: str = ""
    job_type: str = "Internship"
    apply_url: str = ""
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    currency: str = "USD"
    pay_period: str = "unknown"
    status: str = "Open"
    deadline: date | None = None
    notes: str = ""
    is_active: bool = True


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    company_id: int | None = None
    title: str | None = None
    location: str | None = None
    job_type: str | None = None
    apply_url: str | None = None
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    currency: str | None = None
    pay_period: str | None = None
    status: str | None = None
    deadline: date | None = None
    notes: str | None = None
    is_active: bool | None = None


class JobRead(JobBase):
    id: int
    date_added: datetime
    company_name: str
    company_match_score: int


class SummaryRead(BaseModel):
    total_companies: int
    companies_hiring: int
    total_open_roles: int
    applied_count: int
    interview_count: int
    offer_count: int
    average_match_score: float
    priority_companies: list[CompanyRead]
    status_counts: dict[str, int]
    category_counts: dict[str, int]
    tier_counts: dict[str, int]
