# InternRadar

InternRadar is a local job intelligence and application tracking dashboard for internship searches across major technology companies and engineering organizations. Product lines are grouped under their hiring company, avoiding duplicate targets for teams such as AWS, Instagram, and Apple Machine Learning.

## Features

- Dashboard summaries for companies, openings, applications, interviews, offers, and match score
- Sortable, filterable company table plus a responsive card view
- Company notes, statuses, tiers, locations, tags, pay ranges, match scores, and manual opening counts
- CS/SDE-oriented target tiers from `S+` through `D`, including plus tiers, based on engineering depth, selectivity, compensation, and career signal
- Manual internship, co-op, new-grad, full-time, and other job tracking
- Active internship/co-op jobs automatically update company opening counts
- Job filters, application funnel, category breakdowns, tier analytics, and priority targets
- SQLite persistence through FastAPI with automatic first-run seeding
- Logo favicons with initials-based fallbacks
- Seed reset endpoint and UI control

## Run the backend

From the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive API docs are at `http://127.0.0.1:8000/docs`.

## Run the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Vite proxies `/api` requests to the FastAPI server, so both processes need to be running.

## Reset seed data

Use **Reset seed data** at the bottom of the sidebar, or call:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/seed/reset
```

Resetting restores all seeded companies to zero openings and deletes manually added jobs.

## Verification

Backend:

```powershell
cd backend
python -m pip install pytest httpx
python -m pytest
```

Frontend:

```powershell
cd frontend
npm run build
```

## Roadmap

- ATS integrations for Greenhouse, Lever, and Ashby
- Automatic internship detection and job synchronization
- Salary normalization with live exchange rates
- LLM-assisted job-description summaries
- Resume version tracking
- Deadline and opening notifications
