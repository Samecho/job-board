from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import Base, SessionLocal, engine, get_db
from .seed_data import seed_companies


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if (db.scalar(select(func.count(models.Company.id))) or 0) == 0:
            seed_companies(db)
    yield


app = FastAPI(title="InternRadar API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/companies", response_model=list[schemas.CompanyRead])
def list_companies(
    search: str = "",
    tier: str = "",
    category: str = "",
    status: str = "",
    open_only: bool = False,
    db: Session = Depends(get_db),
):
    query = select(models.Company)
    if search:
        needle = f"%{search}%"
        query = query.where(
            models.Company.name.ilike(needle)
            | models.Company.tags.ilike(needle)
            | models.Company.main_locations.ilike(needle)
        )
    if tier:
        query = query.where(models.Company.tier == tier)
    if category:
        query = query.where(models.Company.category == category)
    if status:
        query = query.where(models.Company.application_status == status)
    if open_only:
        query = query.where(models.Company.intern_open_count > 0)
    return db.scalars(query.order_by(models.Company.name)).all()


@app.get("/api/companies/{company_id}", response_model=schemas.CompanyRead)
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return company


@app.post("/api/companies", response_model=schemas.CompanyRead, status_code=201)
def create_company(payload: schemas.CompanyCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Company).where(models.Company.name == payload.name)):
        raise HTTPException(409, "A company with this name already exists")
    company = models.Company(**payload.model_dump(), last_updated=datetime.now(UTC))
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@app.put("/api/companies/{company_id}", response_model=schemas.CompanyRead)
def update_company(
    company_id: int, payload: schemas.CompanyUpdate, db: Session = Depends(get_db)
):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, key, value)
    if "intern_open_count" in payload.model_fields_set:
        company.is_intern_hiring = company.intern_open_count > 0
    company.last_updated = datetime.now(UTC)
    db.commit()
    db.refresh(company)
    return company


@app.delete("/api/companies/{company_id}", status_code=204)
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    db.delete(company)
    db.commit()


@app.get("/api/jobs", response_model=list[schemas.JobRead])
def list_jobs(
    company_id: int | None = None,
    status: str = "",
    job_type: str = "",
    location: str = "",
    db: Session = Depends(get_db),
):
    query = select(models.Job)
    if company_id:
        query = query.where(models.Job.company_id == company_id)
    if status:
        query = query.where(models.Job.status == status)
    if job_type:
        query = query.where(models.Job.job_type == job_type)
    if location:
        query = query.where(models.Job.location.ilike(f"%{location}%"))
    jobs = db.scalars(query.order_by(models.Job.date_added.desc())).all()
    return [crud.job_to_read(job) for job in jobs]


@app.post("/api/jobs", response_model=schemas.JobRead, status_code=201)
def create_job(payload: schemas.JobCreate, db: Session = Depends(get_db)):
    if not db.get(models.Company, payload.company_id):
        raise HTTPException(404, "Company not found")
    job = models.Job(**payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    crud.recalculate_company_jobs(db, job.company_id)
    return crud.job_to_read(job)


@app.put("/api/jobs/{job_id}", response_model=schemas.JobRead)
def update_job(job_id: int, payload: schemas.JobUpdate, db: Session = Depends(get_db)):
    job = db.get(models.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    old_company_id = job.company_id
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    crud.recalculate_company_jobs(db, old_company_id)
    if job.company_id != old_company_id:
        crud.recalculate_company_jobs(db, job.company_id)
    return crud.job_to_read(job)


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(models.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    company_id = job.company_id
    db.delete(job)
    db.commit()
    crud.recalculate_company_jobs(db, company_id)


@app.get("/api/analytics/summary", response_model=schemas.SummaryRead)
def analytics_summary(db: Session = Depends(get_db)):
    companies = list(db.scalars(select(models.Company)).all())
    status_counts = {status: 0 for status in schemas.APPLICATION_STATUSES}
    category_counts: dict[str, int] = {}
    tier_counts = {
        tier: 0 for tier in
        ["S+", "S", "A+", "A", "B+", "B", "C+", "C", "D+", "D"]
    }
    for company in companies:
        status_counts[company.application_status] = status_counts.get(company.application_status, 0) + 1
        category_counts[company.category] = category_counts.get(company.category, 0) + 1
        tier_counts[company.tier] = tier_counts.get(company.tier, 0) + 1
    priority = sorted(
        (c for c in companies if c.application_status == "Not Applied"),
        key=lambda c: c.match_score,
        reverse=True,
    )[:5]
    return {
        "total_companies": len(companies),
        "companies_hiring": sum(c.is_intern_hiring for c in companies),
        "total_open_roles": sum(c.intern_open_count for c in companies),
        "applied_count": status_counts.get("Applied", 0),
        "interview_count": status_counts.get("Interview", 0),
        "offer_count": status_counts.get("Offer", 0),
        "average_match_score": round(sum(c.match_score for c in companies) / len(companies), 1) if companies else 0,
        "priority_companies": priority,
        "status_counts": status_counts,
        "category_counts": category_counts,
        "tier_counts": tier_counts,
    }


@app.post("/api/seed/reset")
def reset_seed(db: Session = Depends(get_db)):
    db.execute(delete(models.Job))
    db.execute(delete(models.Company))
    db.commit()
    seed_companies(db)
    return {"message": "Seed data restored", "companies": len(list(db.scalars(select(models.Company.id))))}
