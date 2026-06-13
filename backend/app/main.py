from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from . import models, schemas
from .ai_service import generate_resume
from .config import get_settings
from .database import Base, SessionLocal, engine, ensure_simple_schema, get_db
from .seed_data import seed_companies


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_simple_schema()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if (db.scalar(select(func.count(models.Company.id))) or 0) == 0:
            seed_companies(db)
        if (db.scalar(select(func.count(models.ResumeProfile.id))) or 0) == 0:
            db.add(models.ResumeProfile())
            db.commit()
    yield


app = FastAPI(title="InternRadar API", version="3.0.0", lifespan=lifespan)
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


def company_read(
    company: models.Company,
    resume_count: int = 0,
) -> schemas.CompanyRead:
    return schemas.CompanyRead(
        id=company.id,
        name=company.name,
        display_name=company.display_name,
        domain=company.domain or "",
        logo_url=company.logo_url,
        career_url=company.career_url or "",
        tier=company.tier or "Conditional",
        category=company.category or "Other",
        main_locations=company.main_locations or "",
        status=company.status or "Not Applied",
        notes=company.notes or "",
        link=company.link or company.career_url or "",
        resume_count=resume_count,
    )


@app.get("/api/companies", response_model=list[schemas.CompanyRead])
def list_companies(db: Session = Depends(get_db)):
    resume_counts = {
        company_id: count
        for company_id, count in db.execute(
            select(
                models.GeneratedResume.company_id,
                func.count(models.GeneratedResume.id),
            ).group_by(models.GeneratedResume.company_id)
        )
    }
    tier_order = case(
        {
            "S+": 0, "S": 1, "A+": 2, "A": 3,
            "B+": 4, "B": 5, "C": 6, "D": 7,
        },
        value=models.Company.tier,
        else_=8,
    )
    return [
        company_read(company, resume_counts.get(company.id, 0))
        for company in db.scalars(
            select(models.Company).order_by(tier_order, models.Company.name)
        )
    ]


@app.get("/api/companies/{company_id}", response_model=schemas.CompanyRead)
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    count = db.scalar(select(func.count(models.GeneratedResume.id)).where(
        models.GeneratedResume.company_id == company_id
    )) or 0
    return company_read(company, count)


@app.put("/api/companies/{company_id}", response_model=schemas.CompanyRead)
def update_company(
    company_id: int,
    payload: schemas.CompanyUpdate,
    db: Session = Depends(get_db),
):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, key, value)
    company.updated_at = datetime.now(UTC)
    db.commit()
    return get_company(company_id, db)


def get_profile(db: Session) -> models.ResumeProfile:
    profile = db.scalar(select(models.ResumeProfile).order_by(models.ResumeProfile.id))
    if profile:
        return profile
    profile = models.ResumeProfile()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def profile_read(profile: models.ResumeProfile) -> schemas.ResumeProfileRead:
    return schemas.ResumeProfileRead(
        id=profile.id,
        name=profile.name or "",
        email=profile.email or "",
        phone=profile.phone or "",
        location=profile.location or "",
        linkedin=profile.linkedin or "",
        github=profile.github or "",
        website=profile.website or "",
        education_text=profile.education_text or "",
        experience_text=profile.experience_text or "",
        projects_text=profile.projects_text or "",
        skills_text=profile.skills_text or "",
        awards_text=profile.awards_text or "",
        other_text=profile.other_text or "",
        updated_at=profile.updated_at,
    )


@app.get("/api/resume-profile", response_model=schemas.ResumeProfileRead)
def read_resume_profile(db: Session = Depends(get_db)):
    return profile_read(get_profile(db))


@app.put("/api/resume-profile", response_model=schemas.ResumeProfileRead)
def update_resume_profile(
    payload: schemas.ResumeProfileBase,
    db: Session = Depends(get_db),
):
    profile = get_profile(db)
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    profile.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(profile)
    return profile_read(profile)


@app.get("/api/features", response_model=schemas.FeatureStatus)
def feature_status():
    settings = get_settings()
    return {
        "ai_enabled": settings.enable_ai_features,
        "ai_configured": bool(settings.deepseek_api_key),
    }


@app.post("/api/resumes/generate", response_model=schemas.ResumeGenerateResponse)
def generate_latex_resume(
    payload: schemas.ResumeGenerateRequest,
    db: Session = Depends(get_db),
):
    company = db.get(models.Company, payload.company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    profile = get_profile(db)
    try:
        latex = generate_resume(
            company,
            profile,
            payload.job_title,
            payload.jd_text,
            payload.extra_instructions,
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, "DeepSeek resume generation failed") from exc
    date = datetime.now().strftime("%Y-%m-%d")
    role = payload.job_title.strip() or "Tailored Resume"
    return {
        "generated_latex": latex,
        "suggested_resume_name": f"{company.name} - {role} - {date}",
        "warnings": [],
    }


def resume_read(resume: models.GeneratedResume) -> schemas.GeneratedResumeRead:
    return schemas.GeneratedResumeRead(
        id=resume.id,
        company_id=resume.company_id,
        company_name=resume.company.name,
        job_title=resume.job_title or "",
        jd_text=resume.jd_text,
        generated_latex=resume.generated_latex,
        resume_name=resume.resume_name,
        notes=resume.notes or "",
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


def resume_or_404(db: Session, resume_id: int) -> models.GeneratedResume:
    resume = db.scalar(
        select(models.GeneratedResume)
        .where(models.GeneratedResume.id == resume_id)
        .options(selectinload(models.GeneratedResume.company))
    )
    if not resume:
        raise HTTPException(404, "Resume not found")
    return resume


@app.post(
    "/api/companies/{company_id}/resumes",
    response_model=schemas.GeneratedResumeRead,
    status_code=201,
)
def save_resume(
    company_id: int,
    payload: schemas.GeneratedResumeBase,
    db: Session = Depends(get_db),
):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    resume = models.GeneratedResume(
        company_id=company_id,
        **payload.model_dump(),
    )
    db.add(resume)
    db.commit()
    return resume_read(resume_or_404(db, resume.id))


@app.get(
    "/api/companies/{company_id}/resumes",
    response_model=list[schemas.GeneratedResumeRead],
)
def company_resumes(company_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Company, company_id):
        raise HTTPException(404, "Company not found")
    resumes = db.scalars(
        select(models.GeneratedResume)
        .where(models.GeneratedResume.company_id == company_id)
        .options(selectinload(models.GeneratedResume.company))
        .order_by(models.GeneratedResume.created_at.desc())
    )
    return [resume_read(resume) for resume in resumes]


@app.get("/api/resumes", response_model=list[schemas.GeneratedResumeRead])
def list_resumes(db: Session = Depends(get_db)):
    resumes = db.scalars(
        select(models.GeneratedResume)
        .options(selectinload(models.GeneratedResume.company))
        .order_by(models.GeneratedResume.created_at.desc())
    )
    return [resume_read(resume) for resume in resumes]


@app.get("/api/resumes/{resume_id}", response_model=schemas.GeneratedResumeRead)
def get_resume(resume_id: int, db: Session = Depends(get_db)):
    return resume_read(resume_or_404(db, resume_id))


@app.put("/api/resumes/{resume_id}", response_model=schemas.GeneratedResumeRead)
def update_resume(
    resume_id: int,
    payload: schemas.GeneratedResumeUpdate,
    db: Session = Depends(get_db),
):
    resume = resume_or_404(db, resume_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(resume, key, value)
    resume.updated_at = datetime.now(UTC)
    db.commit()
    return resume_read(resume_or_404(db, resume_id))


@app.delete("/api/resumes/{resume_id}", status_code=204)
def delete_resume(resume_id: int, db: Session = Depends(get_db)):
    resume = resume_or_404(db, resume_id)
    db.delete(resume)
    db.commit()


@app.get("/api/analytics/summary", response_model=schemas.AnalyticsSummary)
def analytics_summary(db: Session = Depends(get_db)):
    companies = list(db.scalars(select(models.Company)))
    status_counts = {status: 0 for status in schemas.STATUSES}
    tier_counts: dict[str, int] = {}
    for company in companies:
        status_counts[company.status] = status_counts.get(company.status, 0) + 1
        tier = company.tier or "Conditional"
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
    resumes = list(db.scalars(
        select(models.GeneratedResume)
        .options(selectinload(models.GeneratedResume.company))
        .order_by(models.GeneratedResume.created_at.desc())
    ))
    recent = [
        {
            "id": resume.id,
            "company_id": resume.company_id,
            "company_name": resume.company.name,
            "resume_name": resume.resume_name,
            "job_title": resume.job_title or "",
            "created_at": resume.created_at,
        }
        for resume in resumes[:8]
    ]
    return {
        "total_companies": len(companies),
        "applied_count": status_counts.get("Applied", 0),
        "status_counts": status_counts,
        "tier_counts": tier_counts,
        "saved_resume_count": len(resumes),
        "companies_with_resumes": len({resume.company_id for resume in resumes}),
        "recent_resumes": recent,
    }
