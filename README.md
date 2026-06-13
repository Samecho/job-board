# InternRadar

InternRadar is a localhost-only personal company application tracker and DeepSeek-powered Overleaf resume generator.

It keeps a curated company catalog, lets you track application status, notes, locations, and useful links, and stores multiple tailored LaTeX resumes per company.

There is no login, LAN sharing, deployment system, job board, crawler, source sync, match score, or automatic application workflow.

## Features

- Overview table and cards views
- Company status, notes, locations, and useful links
- Personal application analytics
- Editable base resume profile
- DeepSeek-generated complete Overleaf-compatible `.tex` resumes
- Explicit review-before-save workflow
- Multiple saved resumes and JDs per company
- Copy and download `.tex` actions

## Setup

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Frontend:

```powershell
cd frontend
npm install
```

## Run locally

From the project root:

```powershell
.\start-local.bat
```

Open `http://localhost:5173`.

The backend runs at `http://localhost:8000`. The app binds only to localhost.

## Overview

Use the **Overview** tab to switch between table and cards views.

Each company supports:

- Application status
- Locations
- Personal notes
- Careers or application link
- Resume generation and saved history

Double-click a table row or choose **Edit** on a card to edit tracking details. **Resume (N)** shows how many saved resumes belong to that company.

## Analytics

The **Analytics** tab shows:

- Total companies
- Applied, OA, interview, offer, and rejected counts
- Watching and interested counts
- Status funnel
- Companies by tier
- Saved resume count
- Companies with saved resumes
- Recent saved resumes

## Resume Profile

Open the **Resume** tab and complete the base profile:

- Contact information
- Education
- Experience
- Projects
- Skills
- Awards
- Other truthful background information

Plain text or Markdown-style content is accepted. DeepSeek is instructed to use only facts stored in this profile.

## Configure DeepSeek

Edit `backend/.env`:

```dotenv
DEEPSEEK_API_KEY=your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
ENABLE_AI_FEATURES=true
```

Restart the backend after changing the file. The API key remains backend-only.

When AI is disabled or the key is missing, the tracker, profile editor, and saved resume browser continue to work. Resume generation displays:

> Configure DeepSeek API key to generate resumes.

## Generate a Resume

1. Open **Overview**.
2. Choose **Resume** for a company.
3. Enter an optional job title.
4. Paste the complete job description.
5. Add optional tailoring instructions.
6. Choose **Generate LaTeX**.
7. Review and edit the complete `.tex` output.
8. Copy or download it for Overleaf.
9. Choose **Save resume** only when satisfied.

Generation does not automatically save anything. Closing the modal before choosing **Save resume** discards the generated output.

Every saved resume includes:

- Company
- Optional job title
- Original JD
- Generated LaTeX
- Resume name
- Optional notes
- Created and updated timestamps

The company Resume modal shows that company's history. The Resume tab shows all saved resumes and supports JD viewing, LaTeX copying, `.tex` downloading, and deletion.

## Database

The active application tables are:

- `companies`
- `resume_profile`
- `generated_resumes`

Legacy tables may remain in SQLite, but the application does not query them.

Before the first simplification migration, InternRadar creates:

```text
backend/data/internradar-pre-simplify.db
```

The migration preserves the company catalog and copies the earliest existing personal company statuses and notes into the simplified company records where possible.

## Verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

```powershell
cd frontend
npm run build
```
