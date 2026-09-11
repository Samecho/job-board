# InternRadar

InternRadar is a fully client-side GitHub Pages app for SWE/SDE internship tracking and tailored resume generation.

It keeps the curated company catalog, application tracking, notes, AI settings, resume profile, applications, resume versions, PDF/DOCX files, and backups in each user's browser storage. The deployed app does not require a backend, Python, SQLite, `start.bat`, or `stop.bat`.

There is no login, Jobs tab, Sources tab, crawler, match score, priority/pin system, add company flow, reset data flow, or backend deployment feature.

## Features

- Static React/Vite app deployable to GitHub Pages
- IndexedDB browser-local structured data
- Browser-local Blob storage for generated PDF and DOCX files
- Curated SWE/SDE company catalog with tier order `S+`, `S`, `A+`, `A`, `B+`, `B`, `C`, `D`
- Overview table and cards views
- Company notes, locations, useful links, internship-friendly badge, and filters
- Application hierarchy: Company -> Applications -> Resume Versions
- Application stages: Applied, OA, Interview, Rejected, Offer
- Detailed autosaved Resume Profile
- AI Settings stored locally in the browser
- Closed provider/model adapters for OpenAI, Gemini, and GLM
- Deterministic browser rendering for PDF and DOCX from structured resume JSON
- Export Everything / Import Backup ZIP workflow

## Shared Resumes and Refinement

Open a company's Resume dialog to manage its separate applications.
Select applications using the checkboxes directly in the company application list, then Generate for selected.
Applications, named resume groups, and assignment choices in this dialog belong only to the current company.
One AI request considers all selected JDs and saves one PDF/TeX version shared by those applications.
Each application keeps its own stage, JD, and notes; application counts do not count versions.

Application rows show the resume name and version currently assigned to them.
Saved resumes are grouped by an editable name and show which applications use each version.
Select one or more applications, then use a version's Use for selected button to assign it to all of them.
Use Unassign resume in the application editor to remove its assignment.
Star applications using the star button on each row. Starred only filters the application list;
Overview also offers a Starred applications only filter. Stars are saved in IndexedDB and backups.
In version history, Edit / AI refine opens the structured JSON editor. Save manual edit recompiles locally without AI.
Alternatively, enter a refinement instruction and use AI refine for one request with the existing content.
Both save a new version and assign it to the current application only; other applications keep their assignments.
Overlong refinements are rejected instead of silently pruning unrelated content. The original remains available.
Deleting a shared version clears all its assignments, not applications. Deleting an application retains saved versions.
Backup ZIPs preserve sharing, assignments, and refinement lineage. Existing single-application versions remain compatible.

## Run Locally

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```powershell
cd frontend
npm run build
```

Preview the production build:

```powershell
cd frontend
npm run preview
```

## GitHub Pages

The app is configured for static hosting with `base: "./"` in Vite. Deployment is handled by `.github/workflows/pages.yml`.

The workflow:

1. Installs frontend dependencies with `npm ci`
2. Builds the static app
3. Uploads `frontend/dist`
4. Deploys to GitHub Pages

## Local Data

All personal data is stored in the browser on the current device/profile:

- Company notes, links, and locations
- Resume profile
- AI provider settings and API key
- Applications and stages
- Resume versions
- Generated PDF/DOCX files

API keys are not stored in GitHub, Vite environment variables, or normal backups.

## Resume Workflow

1. Open **Overview**.
2. Choose **Resume** for a company.
3. Create or open an Application.
4. Add job title, full job description, stage, and notes.
5. Save the application.
6. Configure AI Settings in the **Resume** tab.
7. Choose **Generate new version**.
8. Every generation creates a new resume version automatically.
9. Preview PDF, download PDF, download DOCX, or delete individual versions.

A company is considered Applied when it has at least one Application. Overview application counts count Applications, not resume versions.

## AI Settings

Resume generation uses a content-only AI response: selected role/subproject IDs, generated bullets/highlights, project technologies, and technical skills. Browser scripts assemble name/contact links, education, employer/organization, actual job title, location, dates, and standalone project names directly from the profile snapshot. Current roles use Present; other dates retain the entered text. Unknown, duplicate, and cross-role references are rejected. Explicitly omitted subproject headings are enforced locally. Existing saved versions retain their original snapshots.

Open **Resume** to choose your provider, model, reasoning effort, and browser-local API key.

- OpenAI offers GPT-5.6 Luna, Terra, Sol, and GPT-6 Astra with supported reasoning levels. Your selected model is always used.
- Dropdown estimates update locally with the current profile, prompt/schema overhead, and an assumed 700-word English JD. Output/reasoning usage is a scenario estimate, not a prediction or limit. No token-count API is called.
- Generate sends one AI generation request, with no dollar budget checks, pricing-expiry blocks, or application-imposed output cap. Higher reasoning can take longer and cost more. There are no automatic paid retries or AI expansion calls; PDF fitting remains local.
- Completion and version history show estimated USD cost from reported OpenAI usage. Missing usage or unsupported provider pricing is shown as unavailable, never zero. Provider billing, cache discounts, and taxes can differ.
- Gemini and GLM generation are available again through their existing official adapters; cost estimates are currently available for OpenAI only.
- API keys stay browser-local and are excluded from backups.

Rates in `frontend/src/lib/aiModels.ts` were checked 2026-09-06 and should be maintained against [official pricing](https://developers.openai.com/api/docs/pricing).

## Catalog Audit

The static catalog contains the September 2026 resume-signal audit. Tiers measure technical reputation and resume recognition; internship availability is tracked separately by the Intern badge. The tier order `S+`, `S`, `A+`, `A`, `B+`, `B`, `C`, `D`.

To reproduce the audit transform:

```powershell
cd frontend
npm run catalog:audit
```

The audit consolidates aliases while preserving local company notes, applications, and saved resume references through a browser IndexedDB migration.
## Backup / Restore

Use **Export Everything** in the Resume tab to download:

```text
InternRadar-backup-YYYY-MM-DD.zip
```

The backup contains `data.json` plus generated resume PDFs and DOCX files under `resumes/`. API keys are excluded by default.

Use **Import Backup** to restore browser-local app data and files.

## Legacy Backend

The old FastAPI/SQLite backend remains in the repository only as legacy source. It is not required for normal app usage or GitHub Pages deployment.
