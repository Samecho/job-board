from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas


def recalculate_company_jobs(db: Session, company_id: int) -> None:
    company = db.get(models.Company, company_id)
    if not company:
        return
    count = db.scalar(
        select(func.count(models.Job.id)).where(
            models.Job.company_id == company_id,
            models.Job.is_active.is_(True),
            models.Job.job_type.in_(["Internship", "Co-op"]),
        )
    ) or 0
    company.intern_open_count = count
    company.is_intern_hiring = count > 0
    company.last_updated = datetime.now(UTC)
    db.commit()


def job_to_read(job: models.Job) -> schemas.JobRead:
    return schemas.JobRead(
        **{column.name: getattr(job, column.name) for column in models.Job.__table__.columns},
        company_name=job.company.name,
        company_match_score=job.company.match_score,
    )
