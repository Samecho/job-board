import shutil
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH = DATA_DIR / "internradar.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


class Base(DeclarativeBase):
    pass


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_simple_schema() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "companies" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("companies")}
    missing = {"status", "notes", "link"} - columns

    backup = DATA_DIR / "internradar-pre-simplify.db"
    if missing and DATABASE_PATH.exists() and not backup.exists():
        shutil.copy2(DATABASE_PATH, backup)

    with engine.begin() as connection:
        if "status" in missing:
            connection.execute(text(
                "ALTER TABLE companies ADD COLUMN status "
                "VARCHAR(24) NOT NULL DEFAULT 'Not Applied'"
            ))
        if "notes" in missing:
            connection.execute(text(
                "ALTER TABLE companies ADD COLUMN notes TEXT"
            ))
        if "link" in missing:
            connection.execute(text(
                "ALTER TABLE companies ADD COLUMN link VARCHAR(1000)"
            ))

        old_tables = set(inspect(connection).get_table_names())
        if "user_company_states" in old_tables:
            user_id = connection.scalar(text(
                "SELECT MIN(user_id) FROM user_company_states"
            ))
            if user_id is not None:
                connection.execute(text("""
                    UPDATE companies
                    SET status = COALESCE((
                            SELECT application_status
                            FROM user_company_states
                            WHERE user_id = :user_id
                              AND company_id = companies.id
                        ), status),
                        notes = COALESCE((
                            SELECT personal_notes
                            FROM user_company_states
                            WHERE user_id = :user_id
                              AND company_id = companies.id
                        ), notes)
                """), {"user_id": user_id})

        connection.execute(text("""
            UPDATE companies
            SET link = COALESCE(NULLIF(link, ''), career_url)
        """))
        connection.execute(text("""
            UPDATE companies
            SET status = CASE
                WHEN status IN ('Applied', 'OA', 'Interview', 'Rejected', 'Offer')
                    THEN 'Applied'
                ELSE 'Not Applied'
            END
        """))
