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

Open **Resume** to choose your provider, model, reasoning effort, and browser-local API key.

- OpenAI models: **GPT-5.6 Luna, Terra, Sol, and GPT-6 Astra** only. Each model lists its supported reasoning efforts. New settings default to Luna / low; existing model selections are preserved, never silently substituted.
- Parenthesized USD estimates compare 6,000 input tokens plus the displayed effort's output allowance (including reasoning). These are illustrative estimates, not guaranteed bills or quality benchmarks.
- Each Generate click permits **one paid generation request**. An input-token count request runs first; a conservative output cap reserves room below **US$0.05**, including reasoning tokens. Over-budget combinations are blocked, not switched to another model. There are no automatic paid retries, compaction, or expansion calls; PDF fitting is local.
- High reasoning may exhaust the budget before valid JSON is returned. Failed/incomplete requests can still incur charges. Saved versions show reported token usage and a cost estimate when available.
- Gemini and GLM settings are retained, but generation is blocked until equivalent verified budget controls are available.
- API keys remain browser-local in IndexedDB and are excluded from backups. Test Connection uses OpenAI model access lookup, not paid inference.

Rates are standard USD prices checked **2026-09-06**, excluding taxes/payment fees. Pricing verification expires **2026-10-06** and then blocks generation until the table in `frontend/src/lib/aiModels.ts` is reviewed and refreshed. The guard relies on published rates, not control over the provider's billing system. Model availability depends on your API account.

References: [official pricing](https://developers.openai.com/api/docs/pricing), [token counting](https://developers.openai.com/api/docs/guides/token-counting), and [reasoning](https://developers.openai.com/api/docs/guides/reasoning). Base URLs remain internal implementation details.

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
