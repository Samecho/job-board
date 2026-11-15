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
- Application stages: Applied, OA, Interview, Rejected, Declined, Offer
- Historical OA/interview milestones and outcome-aware Sankey flows
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
Stage changes retain previously reached milestones. For an older application, use Previously reached
in its editor to record a confirmed OA or interview before marking its final outcome.
Declined is the candidate's decision, distinct from an employer rejection.
Analytics routes those applications through their recorded milestones into the relevant outcome;
it does not assume that a rejected application had an OA or interview.
Completed OAs awaiting a decision flow from OA into Pending. Other active OAs
flow into Not completed, including those without recorded completion; the chart
does not change their stored completion status or imply that completion means passing.

Application rows show the resume name and version currently assigned to them.
Saved resumes are grouped by an editable name and show which applications use each version.
Select one or more applications, then use a version's Use for selected button to assign it to all of them.
Use Unassign resume in the application editor to remove its assignment.
Favourite companies using the star beside their name in Overview's table or cards.
The Favourites only filter shows favourite companies, independently of their applications.
Company favourites are saved in IndexedDB and backups; positions do not have favourite controls.
In version history, Edit / AI refine opens the structured JSON editor. Save manual edit recompiles locally without AI.
Alternatively, enter a refinement instruction and use AI refine for one request with the existing content.
Both save a new version and assign it to the current application only; other applications keep their assignments.
Overlong refinements are rejected instead of silently pruning unrelated content. The original remains available.
Newly generated or manually recompiled resumes show each Experience organization/company on the first line and the job title on the second, with dates and location on the right. Education retains institution first and degree second. Existing saved PDFs remain unchanged until a new version is generated or recompiled.
Deleting a shared version clears all its assignments, not applications. Deleting an application retains saved versions.
Backup ZIPs preserve sharing, assignments, and refinement lineage. Existing single-application versions remain compatible.

## JSON Console

Open **Console** in the sidebar. This is a small, browser-local command interface,
not a public API or a JavaScript terminal. It uses the same IndexedDB records as
Overview, Analytics and Resume; it makes no AI or employer-site requests.

1. Download a backup before bulk changes. Keep the ZIP private; it contains personal
   records and PDFs (but not the AI API key).
2. Query companies and applications for their exact IDs. Existing records may only
   have their requisition number in the title or notes; use the returned application
   ID until the structured `requisition_id` is populated.
3. Paste JSON, choose **Preview without saving**, then **Run command** (or Ctrl/Cmd+Enter).
   Every batch validates fully and commits in one transaction. An error saves none
   of the batch. Missing fields stay unchanged; `notes` replaces the existing notes.
4. For PDFs, first use **Attach PDFs**, then `import_resume` with the exact filename.
   Selecting a file alone does not save it. Imported PDFs are retained byte-for-byte,
   can be previewed/downloaded in the company Resume dialog, and cannot be AI-refined.

```json
{"action":"query","entity":"companies","search":"Amazon"}
```

```json
{"action":"query","entity":"applications","company_id":123,"include_jd":true}
```

IDs below are placeholders: replace them with query results.

```json
{
  "action": "batch",
  "request_id": "mail-review-2026-11-14-01",
  "operations": [
    {"action":"update_application","id":456,"changes":{"application_stage":"OA","assessment_status":"completed"}},
    {"action":"update_application","id":789,"changes":{"application_stage":"Rejected"}},
    {"action":"import_resume","company_id":123,"file":"Company_Yutong_Zha_Resume.pdf","application_ids":[456,789]}
  ]
}
```

- `query`: entities `companies`, `applications`, `resumes`, `history`. Filters:
  `search`, `company_id`, `ids`, `limit` (default 50, max 200), `offset`.
  `applications` also supports `stage` and `include_jd`; `history` only supports
  search/pagination. Queries exclude PDF blobs, profile and AI settings.
- `update_application`: target `id`, or `job: {company_id, requisition_id}`.
  Optional `expected_updated_at` rejects stale edits. Editable fields are listed
  in the Console's built-in reference; previous milestones are retained.
- `create_application`: requires `company_id` and `data` with `requisition_id`,
  `job_title` and full `job_description`. Use only for submitted roles, not drafts.
  Duplicate requisitions are rejected, including possible legacy title/notes matches.
- `import_resume`: `company_id`, exact `file`, optional `title` and `application_ids`.
  PDFs are limited to 10 MB each; identical uploads within a company are reused.
- `assign_resume`: `resume_id` and `application_ids` (same company); `null` removes
  an assignment without deleting the file. Associations do not upload to employers
  or independently verify submission.

Use a new `request_id` for each new batch (max 50 operations). Repeating an identical
batch replays its receipt without reapplying it; changing its content requires a new
ID. File-import retries must reattach the same PDFs. Receipts and before/after values
are local and included in new backups. There are no delete, restore, script or
credential commands. Database v4 adds only a receipt store; existing records/PDFs
are not rewritten. Localhost and GitHub Pages have separate browser databases.

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
3. Review the company's official openings and shortlist relevant technical internships before generating.
4. Save each suitable role as its own Application, with its job title, full JD, stage, and notes. Keep unrelated roles such as product management out of the shared-resume selection.
5. Configure AI Settings in the **Resume** tab.
6. Check all shortlisted applications in this company's modal and choose **Generate for N selected**.
7. One AI call creates one focused company resume from the selected JDs and assigns the same version to every selected application. The prompt prioritizes their shared technical direction rather than combining every keyword.
8. Every generation creates a new resume version automatically. Use **Use for selected** to assign an existing version to additional suitable applications without regenerating.
9. Preview the actual PDF, download PDF or `.tex`, or delete individual versions. Use the same company PDF when applying to the selected roles.

A company is considered Applied when it has at least one Application. Overview application counts count Applications, not resume versions.

## AI Settings

### Certifications

In **Resume -> Resume Profile**, use **Add certification** before Technical Skills.
Each entry has a certificate name, an optional verification URL, and an optional brief description.
Changes autosave with the rest of the profile and are included in browser-local backups.

Generation selects JD-relevant certificates and writes only a short description for each.
The script preserves the entered credential name and verification link; AI cannot invent credentials or links.
In PDF and TeX exports, the name is a clickable hyperlink, not a displayed raw URL.
Each certificate's title is on its own line, followed by its brief description on the next line. An empty description adds no blank description line.
Use a complete `https://` or `http://` verification link; without a link, the name appears as plain text.
The optional Certifications section follows Projects and precedes Technical Skills, and is omitted when empty.
AI budgets the whole page together, compressing weaker material before sacrificing strong engineering evidence.
Local overflow handling can shorten descriptions or omit lower-value certificates to preserve the one-page format.
Fonts, margins, the browser LaTeX compiler, and the rest of the template remain unchanged.
Existing profiles and saved resume versions without certifications remain compatible; old PDFs are not rewritten.
Previously generated inline certificate layouts remain in their saved PDFs; a manual edit/recompile or new generation uses the updated two-line layout.

### Provider Settings

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
