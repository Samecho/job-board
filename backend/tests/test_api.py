from fastapi.testclient import TestClient

from app.main import app


def test_seed_and_job_count():
    with TestClient(app) as client:
        reset = client.post("/api/seed/reset")
        assert reset.status_code == 200
        assert reset.json()["companies"] >= 390
        companies = client.get("/api/companies").json()
        assert len(companies) >= 390
        assert len({company["name"] for company in companies}) == len(companies)
        valid_tiers = {"S+", "S", "A+", "A", "B+", "B", "C+", "C", "D+", "D"}
        assert {company["tier"] for company in companies} <= valid_tiers
        tiers = {company["name"]: company["tier"] for company in companies}
        assert tiers["Jane Street"] == "S+"
        assert tiers["Amazon"] == "A+"
        assert tiers["Pfizer"] == "D"
        requested = {
            "Apple", "Meta", "Google", "Microsoft", "Amazon", "ByteDance",
            "Docker", "Temporal", "CoreWeave", "Applied Intuition", "Tempus AI",
        }
        assert requested <= set(tiers)
        merged_products = {
            "Apple Machine Learning", "Apple Vision Pro", "Instagram", "WhatsApp",
            "Google Cloud", "Google Research", "Amazon Web Services", "Prime Video",
            "GitHub Copilot", "TikTok", "CapCut", "Tencent Games",
        }
        assert not merged_products & set(tiers)
        career_urls = {company["name"]: company["career_url"] for company in companies}
        assert career_urls["GitHub"].startswith("https://www.github.careers/")
        assert career_urls["ByteDance"].startswith("https://jobs.bytedance.com/")
        assert all(url.startswith("https://") for url in career_urls.values())
        assert all(company["intern_open_count"] == 0 for company in companies)

        company = companies[0]
        response = client.post("/api/jobs", json={
            "company_id": company["id"],
            "title": "Software Engineering Intern",
            "location": "Toronto, Canada",
            "job_type": "Internship",
            "apply_url": "",
            "salary_min": 35,
            "salary_max": 45,
            "currency": "CAD",
            "pay_period": "hourly",
            "status": "Open",
            "deadline": None,
            "notes": "",
            "is_active": True,
        })
        assert response.status_code == 201
        updated = client.get(f"/api/companies/{company['id']}").json()
        assert updated["intern_open_count"] == 1
        assert updated["is_intern_hiring"] is True

        client.delete(f"/api/jobs/{response.json()['id']}")
        restored = client.get(f"/api/companies/{company['id']}").json()
        assert restored["intern_open_count"] == 0
