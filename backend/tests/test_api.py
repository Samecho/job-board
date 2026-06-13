from uuid import uuid4

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def test_simplified_tracker_and_resume_flow(monkeypatch):
    with TestClient(app) as client:
        companies = client.get("/api/companies")
        assert companies.status_code == 200
        assert len(companies.json()) >= 496
        names = {item["name"] for item in companies.json()}
        assert {
            "Snap", "Spotify", "Duolingo", "Glean", "Together AI",
            "Fireworks AI", "Akuna Capital", "Virtu Financial",
            "Cognition", "Sierra AI", "Decagon", "Abridge", "Poolside",
            "Magic", "OpenRouter", "Weights & Biases", "Anaconda",
            "Untether AI", "Geotab", "Nuvei", "Mappedin", "ClickHouse",
            "MotherDuck", "Astral", "Turso", "Lyft",
            "Mercor", "OpenEvidence", "Midjourney", "Ideogram", "Pika",
            "Suno", "Synthesia", "Replicate", "Baseten", "Sourcegraph",
            "Railway", "Render", "Fly.io", "Clerk", "Convex", "Browserbase",
            "Nango", "Firecrawl", "Braintrust", "Arize AI", "Langfuse",
            "Helicone", "Beacon Software", "Fellow", "Solace", "Rewind",
            "Fullscript", "Hopper", "Neo Financial", "KOHO", "Borrowell",
            "Euna Solutions", "Forescout", "Terminal", "Zip",
            "Communications Security Establishment", "CSIS", "Bank of Canada",
            "Statistics Canada", "Canadian Digital Service",
            "National Research Council Canada",
            "Defence Research and Development Canada",
            "Shared Services Canada", "CPP Investments", "OMERS",
            "Ontario Teachers' Pension Plan", "CDPQ", "Desjardins",
            "Alibaba", "Kuaishou", "MiniMax", "Z.ai", "01.AI",
            "Moonshot AI", "SenseTime", "NASA",
        } <= names
        assert {
            "ByteDance Seed", "TikTok AI", "BytePlus", "Qwen",
            "Tencent Hunyuan", "Tencent Cloud", "Kling AI", "Kimi",
            "SenseNova", "Huawei Cloud Pangu", "Zhipu AI",
        }.isdisjoint(names)
        assert "Codeium" not in names
        assert "Windsurf" not in names
        tiers = {item["name"]: item["tier"] for item in companies.json()}
        assert tiers["OpenAI"] == "S+"
        assert tiers["Databricks"] == "S"
        assert tiers["Microsoft"] == "A+"
        assert tiers["Spotify"] == "A"
        assert tiers["ASML"] == "B+"
        assert tiers["Salesforce"] == "B"
        assert tiers["Boeing"] == "C"
        assert tiers["Pfizer"] == "D"
        assert set(tiers.values()) == {"S+", "S", "A+", "A", "B+", "B", "C", "D"}
        assert companies.json()[0]["tier"] == "S+"
        s_plus_names = [
            item["name"] for item in companies.json() if item["tier"] == "S+"
        ]
        assert s_plus_names == sorted(s_plus_names)
        company = next(item for item in companies.json() if item["name"] == "Google")
        original_company = company.copy()
        original_profile = client.get("/api/resume-profile").json()

        updated = client.put(f"/api/companies/{company['id']}", json={
            "status": "Applied",
            "notes": "Track this application",
            "link": "https://careers.google.com/",
            "main_locations": "Toronto, Canada",
        })
        assert updated.status_code == 200
        assert updated.json()["status"] == "Applied"
        assert updated.json()["notes"] == "Track this application"
        invalid_status = client.put(
            f"/api/companies/{company['id']}",
            json={"status": "Interview"},
        )
        assert invalid_status.status_code == 422

        profile = client.put("/api/resume-profile", json={
            "name": "Test Student",
            "email": "test@example.com",
            "phone": "",
            "location": "Vancouver",
            "linkedin": "",
            "github": "",
            "website": "",
            "education_text": "BSc Computer Science and Statistics",
            "experience_text": "Built a Python data pipeline.",
            "projects_text": "Created a FastAPI application.",
            "skills_text": "Python, SQL, FastAPI",
            "awards_text": "",
            "other_text": "",
        })
        assert profile.status_code == 200
        assert profile.json()["name"] == "Test Student"

        monkeypatch.setenv("ENABLE_AI_FEATURES", "false")
        monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
        get_settings.cache_clear()
        disabled = client.post("/api/resumes/generate", json={
            "company_id": company["id"],
            "job_title": "Software Engineering Intern",
            "jd_text": "Build reliable backend services using Python and SQL.",
            "extra_instructions": "",
        })
        assert disabled.status_code == 503

        monkeypatch.setenv("ENABLE_AI_FEATURES", "true")
        monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
        get_settings.cache_clear()
        generated_latex = (
            "% Generated by InternRadar\n"
            "\\documentclass{article}\n"
            "\\begin{document}\nTest Student\n\\end{document}"
        )
        monkeypatch.setattr(
            "app.main.generate_resume",
            lambda *_args, **_kwargs: generated_latex,
        )
        before_generate = len(client.get("/api/resumes").json())
        generated = client.post("/api/resumes/generate", json={
            "company_id": company["id"],
            "job_title": "Software Engineering Intern",
            "jd_text": "Build reliable backend services using Python and SQL.",
            "extra_instructions": "",
        })
        assert generated.status_code == 200
        assert generated.json()["generated_latex"] == generated_latex
        assert len(client.get("/api/resumes").json()) == before_generate

        resume_name = f"Google Resume {uuid4().hex[:8]}"
        saved = client.post(f"/api/companies/{company['id']}/resumes", json={
            "job_title": "Software Engineering Intern",
            "jd_text": "Build reliable backend services using Python and SQL.",
            "generated_latex": generated_latex,
            "resume_name": resume_name,
            "notes": "Reviewed and approved",
        })
        assert saved.status_code == 201
        resume_id = saved.json()["id"]
        count_after_save = client.get(
            f"/api/companies/{company['id']}"
        ).json()["resume_count"]
        assert count_after_save == original_company["resume_count"] + 1

        history = client.get(f"/api/companies/{company['id']}/resumes")
        assert any(item["id"] == resume_id for item in history.json())
        analytics = client.get("/api/analytics/summary").json()
        assert analytics["saved_resume_count"] >= 1
        assert analytics["companies_with_resumes"] >= 1
        assert list(analytics["tier_counts"]) == [
            "S+", "S", "A+", "A", "B+", "B", "C", "D",
        ]

        assert client.delete(f"/api/resumes/{resume_id}").status_code == 204
        count_after_delete = client.get(
            f"/api/companies/{company['id']}"
        ).json()["resume_count"]
        assert count_after_delete == original_company["resume_count"]

        client.put(f"/api/companies/{company['id']}", json={
            "status": original_company["status"],
            "notes": original_company["notes"],
            "link": original_company["link"],
            "main_locations": original_company["main_locations"],
        })
        client.put("/api/resume-profile", json={
            key: value for key, value in original_profile.items()
            if key not in {"id", "updated_at"}
        })

        monkeypatch.setenv("ENABLE_AI_FEATURES", "false")
        monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
        get_settings.cache_clear()
