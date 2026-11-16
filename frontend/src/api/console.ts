import { databaseRequest as request, databaseTransaction as transaction } from "./client";
import { COMPANY_CATALOG } from "../data/catalog";
import { APPLICATION_STAGES, applicationHistory } from "../lib/applicationStages";
import { asPdfBlob } from "../lib/resumeFiles";
import type { Application, ApplicationStage, ResumeVersion } from "../types";

type ObjectValue = Record<string, unknown>;
type JobKey = { company_id: number; requisition_id: string };
type Target = { id: number; job?: never } | { id?: never; job: JobKey };
type Changes = Partial<Pick<Application, "job_title" | "job_description" | "notes" | "application_stage" | "assessment_status" | "reference_status" | "requisition_id" | "job_url" | "location" | "application_email" | "submitted_at" | "assessment_url" | "assessment_deadline" | "submission_evidence" | "stage_history">>;
type Operation =
  | ({ action: "update_application"; changes: Changes; expected_updated_at?: string } & Target)
  | { action: "create_application"; company_id: number; data: Changes & { requisition_id: string; job_title: string; job_description: string } }
  | { action: "assign_resume"; application_ids: number[]; resume_id: number | null }
  | { action: "import_resume"; company_id: number; file: string; title?: string; application_ids: number[] };
type Query = { action: "query"; entity: "companies" | "applications" | "resumes" | "history"; company_id?: number; search?: string; stage?: ApplicationStage; ids?: number[]; limit: number; offset: number; include_jd?: boolean };
type Batch = { action: "batch"; request_id: string; operations: Operation[] };
type Upload = { file: File; sha256: string };
type Receipt = { request_id: string; fingerprint: string; created_at: string; results: unknown[]; changes: unknown[] };
export type ConsoleResponse = { ok: true; mode: "query" | "preview" | "applied" | "replayed"; [key: string]: unknown };

function object(value: unknown, label: string): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as ObjectValue;
}
function keys(value: ObjectValue, allowed: string[]) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown field: ${key}`);
}
function text(value: unknown, label: string, required = false): string {
  if (typeof value !== "string" || (required && !value.trim())) throw new Error(`${label} must be ${required ? "a non-empty" : "a"} string.`);
  return value;
}
function positive(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
}
function ids(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error(`${label} must contain 1-100 IDs.`);
  const result = value.map(id => positive(id, label));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicate IDs.`);
  return result;
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value as T)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return value as T;
}
function companyId(value: unknown): number {
  const id = positive(value, "company_id");
  if (!COMPANY_CATALOG.some(company => company.id === id)) throw new Error(`Unknown company_id: ${id}. Query companies first.`);
  return id;
}
function jobKey(value: unknown): JobKey {
  const job = object(value, "job"); keys(job, ["company_id", "requisition_id"]);
  return { company_id: companyId(job.company_id), requisition_id: text(job.requisition_id, "requisition_id", true).trim() };
}
const textFields = ["job_title", "job_description", "notes", "requisition_id", "job_url", "location", "application_email", "submitted_at", "assessment_url", "assessment_deadline", "submission_evidence"];
function changes(value: unknown): Changes {
  const data = object(value, "changes");
  keys(data, [...textFields, "application_stage", "assessment_status", "reference_status", "stage_history"]);
  if (!Object.keys(data).length) throw new Error("changes cannot be empty.");
  for (const key of textFields) if (key in data) text(data[key], key, key === "job_title" || key === "requisition_id");
  for (const key of ["job_url", "assessment_url"]) if (data[key]) {
    let url: URL;
    try { url = new URL(String(data[key])); } catch { throw new Error(`${key} must be an http(s) URL.`); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error(`${key} must be an http(s) URL without credentials.`);
  }
  for (const key of ["submitted_at", "assessment_deadline"]) if (data[key] && (!/^\d{4}-\d{2}-\d{2}(T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(String(data[key])) || !Number.isFinite(Date.parse(String(data[key]))))) throw new Error(`${key} must be an ISO date or timestamp with timezone.`);
  if (data.application_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.application_email))) throw new Error("Invalid application_email.");
  if ("application_stage" in data) enumValue(data.application_stage, APPLICATION_STAGES, "application_stage");
  if ("assessment_status" in data) enumValue(data.assessment_status, ["unknown", "not_completed", "completed"], "assessment_status");
  if ("reference_status" in data) enumValue(data.reference_status, ["unknown", "required", "unavailable", "provided"], "reference_status");
  if ("stage_history" in data) {
    if (!Array.isArray(data.stage_history)) throw new Error("stage_history must be an array.");
    data.stage_history.forEach(stage => enumValue(stage, APPLICATION_STAGES, "stage_history"));
  }
  return data as Changes;
}
function operation(value: unknown): Operation {
  const op = object(value, "operation");
  switch (op.action) {
    case "update_application": {
      keys(op, ["action", "id", "job", "changes", "expected_updated_at"]);
      if (("id" in op) === ("job" in op)) throw new Error("Specify exactly one of id or job.");
      if (op.expected_updated_at !== undefined) text(op.expected_updated_at, "expected_updated_at", true);
      return { action: op.action, ...("id" in op ? { id: positive(op.id, "id") } : { job: jobKey(op.job) }), changes: changes(op.changes), expected_updated_at: op.expected_updated_at as string | undefined };
    }
    case "create_application": {
      keys(op, ["action", "company_id", "data"]);
      const data = changes(op.data);
      for (const field of ["requisition_id", "job_title", "job_description"] as const) text(data[field], field, true);
      return { action: op.action, company_id: companyId(op.company_id), data: data as Changes & { requisition_id: string; job_title: string; job_description: string } };
    }
    case "assign_resume":
      keys(op, ["action", "application_ids", "resume_id"]);
      return { action: op.action, application_ids: ids(op.application_ids, "application_ids"), resume_id: op.resume_id === null ? null : positive(op.resume_id, "resume_id") };
    case "import_resume":
      keys(op, ["action", "company_id", "file", "title", "application_ids"]);
      return { action: op.action, company_id: companyId(op.company_id), file: text(op.file, "file", true), title: op.title === undefined ? undefined : text(op.title, "title", true), application_ids: op.application_ids === undefined ? [] : ids(op.application_ids, "application_ids") };
    default: throw new Error(`Unsupported action: ${String(op.action)}`);
  }
}
export function parseConsoleCommand(source: string): Query | Batch {
  if (source.length > 2_000_000) throw new Error("Command is too large (maximum 2 MB text).");
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("Invalid JSON. Use double quotes and remove trailing commas."); }
  const data = object(parsed, "command");
  if (data.action === "query") {
    keys(data, ["action", "entity", "company_id", "search", "stage", "ids", "limit", "offset", "include_jd"]);
    const entity = enumValue(data.entity, ["companies", "applications", "resumes", "history"], "entity");
    const limit = data.limit === undefined ? 50 : positive(data.limit, "limit");
    if (limit > 200) throw new Error("limit cannot exceed 200. Use offset for the next page.");
    const offset = data.offset ?? 0;
    if (!Number.isSafeInteger(offset) || Number(offset) < 0) throw new Error("offset must be a nonnegative integer.");
    if (data.include_jd !== undefined && typeof data.include_jd !== "boolean") throw new Error("include_jd must be boolean.");
    if (entity === "history" && (data.company_id !== undefined || data.stage !== undefined || data.ids !== undefined || data.include_jd !== undefined)) throw new Error("history supports search, limit and offset only.");
    if (entity !== "applications" && (data.stage !== undefined || data.include_jd !== undefined)) throw new Error("stage and include_jd apply to applications only.");
    return { action: "query", entity, limit, offset: Number(offset), ...(data.company_id === undefined ? {} : { company_id: companyId(data.company_id) }), ...(data.search === undefined ? {} : { search: text(data.search, "search") }), ...(data.stage === undefined ? {} : { stage: enumValue(data.stage, APPLICATION_STAGES, "stage") }), ...(data.ids === undefined ? {} : { ids: ids(data.ids, "ids") }), include_jd: data.include_jd as boolean | undefined };
  }
  keys(data, ["action", "request_id", "operations"]);
  if (data.action !== "batch") throw new Error("action must be query or batch.");
  const requestId = text(data.request_id, "request_id", true);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) throw new Error("request_id must contain 1-128 letters, digits, dots, colons, underscores or hyphens.");
  if (!Array.isArray(data.operations) || !data.operations.length || data.operations.length > 50) throw new Error("operations must contain 1-50 items.");
  return { action: "batch", request_id: requestId, operations: data.operations.map(operation) };
}

const stores = ["applications", "resume_versions", "console_requests"];
const nameOf = (id: number) => COMPANY_CATALOG.find(company => company.id === id)?.name || "Unknown";
const keyOf = (value: string) => value.trim().toLowerCase();
function applicationResult(app: Application, includeJD = false) {
  const { job_description, ...rest } = app;
  return { ...rest, company_name: nameOf(app.company_id), ...(includeJD ? { job_description } : { has_jd: Boolean(job_description) }) };
}
function resumeResult(resume: ResumeVersion) {
  return { id: resume.id, company_id: resume.company_id, company_name: nameOf(resume.company_id), title: resume.resume_title, version: resume.version_number, source: resume.source || "generated", file_name: resume.file_name, sha256: resume.sha256, created_at: resume.created_at };
}
async function digest(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function resolveApplication(apps: Application[], target: Target): Application {
  const found = apps.filter(app => target.id !== undefined ? app.id === target.id : app.company_id === target.job.company_id && keyOf(app.requisition_id || "") === keyOf(target.job.requisition_id));
  if (found.length !== 1) throw new Error(found.length ? "Ambiguous application. Query first and use an exact ID." : "Application not found. Legacy records may only have the requisition in their title/notes; query first and use an exact ID.");
  return found[0];
}

export async function executeConsoleCommand(source: string, files: File[] = [], preview = false): Promise<ConsoleResponse> {
  const command = parseConsoleCommand(source);
  if (command.action === "query") return transaction(stores, "readonly", async (_, tx) => {
    const apps = await request<Application[]>(tx.objectStore("applications").getAll());
    let rows: ObjectValue[];
    if (command.entity === "applications") rows = apps.filter(app => !command.stage || app.application_stage === command.stage).map(app => applicationResult(app, command.include_jd));
    else if (command.entity === "companies") rows = COMPANY_CATALOG.map(company => ({ id: company.id, company_id: company.id, name: company.name, tier: company.tier, application_count: apps.filter(app => app.company_id === company.id).length }));
    else if (command.entity === "resumes") rows = (await request<ResumeVersion[]>(tx.objectStore("resume_versions").getAll())).map(resume => ({ ...resumeResult(resume), assigned_application_ids: apps.filter(app => app.assigned_resume_version_id === resume.id).map(app => app.id) }));
    else rows = (await request<Receipt[]>(tx.objectStore("console_requests").getAll())).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(({ fingerprint: _fingerprint, ...receipt }) => receipt);
    rows = rows.filter(row => (!command.company_id || row.company_id === command.company_id) && (!command.ids || command.ids.includes(Number(row.id))) && (!command.search || JSON.stringify(row).toLowerCase().includes(command.search.toLowerCase())));
    return { ok: true, mode: "query", total: rows.length, offset: command.offset, items: rows.slice(command.offset, command.offset + command.limit) };
  });

  // Read and validate selected files before opening the IndexedDB transaction.
  const uploads = new Map<string, Upload>();
  for (const op of command.operations) if (op.action === "import_resume" && !uploads.has(op.file)) {
    const candidates = files.filter(file => file.name === op.file);
    if (candidates.length !== 1) throw new Error(`Select exactly one file named ${op.file} in Attach PDFs.`);
    const file = candidates[0];
    if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Each resume must be a PDF of at most 10 MB.");
    const bytes = await file.arrayBuffer();
    if (!new TextDecoder().decode(bytes.slice(0, 5)).startsWith("%PDF-")) throw new Error(`${file.name} is not a PDF.`);
    uploads.set(op.file, { file, sha256: await digest(bytes) });
  }
  const fingerprint = await digest(new TextEncoder().encode(JSON.stringify({ command, files: [...uploads].map(([name, upload]) => [name, upload.sha256]) })).buffer);
  return transaction(stores, preview ? "readonly" : "readwrite", async (_, tx) => {
    const log = tx.objectStore("console_requests");
    const old = await request<Receipt | undefined>(log.get(command.request_id));
    if (old) {
      if (old.fingerprint !== fingerprint) throw new Error("request_id already used for different content. Use a new request_id.");
      return { ok: true, mode: "replayed", request_id: command.request_id, results: old.results, changes: old.changes };
    }
    const appStore = tx.objectStore("applications"), resumeStore = tx.objectStore("resume_versions");
    const apps = await request<Application[]>(appStore.getAll());
    const originalApps = new Map(apps.map(app => [app.id, app]));
    const resumes = await request<ResumeVersion[]>(resumeStore.getAll());
    const originalResumes = new Map(resumes.map(resume => [resume.id, resume]));
    const results: ObjectValue[] = [];
    let temporaryId = -1;
    const now = new Date().toISOString();
    const replace = (app: Application) => { apps[apps.findIndex(item => item.id === app.id)] = app; };
    const assign = (applicationIds: number[], resumeId: number | null) => {
      const resume = resumeId === null ? undefined : resumes.find(item => item.id === resumeId);
      if (resumeId !== null && !resume) throw new Error(`Resume ${resumeId} not found.`);
      for (const id of applicationIds) {
        const app = resolveApplication(apps, { id });
        if (resume && app.company_id !== resume.company_id) throw new Error("Resume and application must belong to the same company.");
        replace({ ...app, assigned_resume_version_id: resumeId, updated_at: now });
      }
      if (resume) resumes[resumes.indexOf(resume)] = { ...resume, application_ids: [...new Set([...(resume.application_ids ?? [resume.application_id]), ...applicationIds])] };
    };
    for (const op of command.operations) {
      if (op.action === "create_application") {
        if (apps.some(app => app.company_id === op.company_id && keyOf(app.requisition_id || "") === keyOf(op.data.requisition_id))) throw new Error("Requisition already exists. Query and update the existing application.");
        // Never silently reinterpret a legacy title/notes match as a new role.
        const escaped = op.data.requisition_id.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const legacyMatch = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
        if (apps.some(app => app.company_id === op.company_id && !app.requisition_id && legacyMatch.test(app.job_title + "\n" + app.notes))) throw new Error("Possible legacy duplicate in title/notes. Query and update it by ID instead.");
        const app: Application = { id: temporaryId--, company_id: op.company_id, application_stage: "Applied", notes: "", ...op.data, requisition_id: op.data.requisition_id.trim(), created_at: now, updated_at: now };
        app.stage_history = applicationHistory(app);
        apps.push(app); results.push({ action: op.action, application_id: app.id });
      } else if (op.action === "update_application") {
        const app = resolveApplication(apps, op);
        if (op.expected_updated_at && (originalApps.get(app.id)?.updated_at ?? app.updated_at) !== op.expected_updated_at) throw new Error(`Application ${app.id} changed since it was queried. Query again before updating.`);
        const next = { ...app, ...op.changes, stage_history: applicationHistory(app, op.changes.application_stage ?? app.application_stage, [...(app.stage_history || []), ...(op.changes.stage_history || [])]), updated_at: now };
        if (next.requisition_id) {
          next.requisition_id = next.requisition_id.trim();
          if (apps.some(other => other.id !== app.id && other.company_id === app.company_id && keyOf(other.requisition_id || "") === keyOf(next.requisition_id!))) throw new Error("Requisition already belongs to another application.");
        }
        replace(next); results.push({ action: op.action, application_id: app.id });
      } else if (op.action === "assign_resume") {
        assign(op.application_ids, op.resume_id); results.push({ action: op.action, application_ids: op.application_ids, resume_id: op.resume_id });
      } else {
        const upload = uploads.get(op.file)!;
        let resume = resumes.find(item => item.company_id === op.company_id && item.sha256 === upload.sha256 && item.source === "uploaded");
        const reused = Boolean(resume);
        if (!resume) {
          const id = temporaryId--;
          resume = { id, company_id: op.company_id, application_id: op.application_ids[0] || 0, application_ids: [], resume_group_id: `upload:${op.company_id}:${upload.sha256}`, resume_title: op.title || op.file, version_number: 1, structured_resume: null, tex_source: "", pdf_file: asPdfBlob(upload.file), provider: "uploaded", model: "External PDF", source: "uploaded", file_name: op.file, sha256: upload.sha256, created_at: now };
          resumes.push(resume);
        }
        assign(op.application_ids, resume.id);
        results.push({ action: op.action, resume_id: resume.id, file_name: op.file, reused });
      }
    }
    // Validation completed for the whole batch. Commit once, or return a read-only preview.
    const changedApps = apps.filter(app => originalApps.get(app.id) !== app);
    const changedResumes = resumes.filter(resume => originalResumes.get(resume.id) !== resume);
    const newIds = new Map<number, number>();
    if (!preview) {
      for (const app of changedApps.filter(app => app.id < 0)) {
        const { id, ...data } = app; newIds.set(id, Number(await request(appStore.add(data))));
      }
      for (const resume of changedResumes.filter(resume => resume.id < 0)) {
        const { id, ...data } = resume; newIds.set(id, Number(await request(resumeStore.add(data))));
      }
    }
    const mapped = (id: number) => newIds.get(id) ?? id;
    const resultRows = results.map(result => ({ ...result, ...(typeof result.application_id === "number" ? { application_id: mapped(result.application_id) } : {}), ...(typeof result.resume_id === "number" ? { resume_id: mapped(result.resume_id) } : {}) }));
    const changeRows: unknown[] = changedApps.map(app => {
      const before = originalApps.get(app.id);
      const includeJD = !before || before.job_description !== app.job_description;
      return { entity: "application", id: mapped(app.id), before: before ? applicationResult(before, includeJD) : null, after: applicationResult({ ...app, id: mapped(app.id), assigned_resume_version_id: app.assigned_resume_version_id == null ? app.assigned_resume_version_id : mapped(app.assigned_resume_version_id) }, includeJD) };
    });
    for (const resume of changedResumes) changeRows.push({ entity: "resume", before: originalResumes.has(resume.id) ? resumeResult(originalResumes.get(resume.id)!) : null, after: resumeResult({ ...resume, id: mapped(resume.id) }) });
    if (!preview) {
      for (const app of changedApps) await request(appStore.put({ ...app, id: mapped(app.id), assigned_resume_version_id: app.assigned_resume_version_id == null ? app.assigned_resume_version_id : mapped(app.assigned_resume_version_id) }));
      for (const resume of changedResumes) await request(resumeStore.put({ ...resume, id: mapped(resume.id), application_id: mapped(resume.application_id), application_ids: resume.application_ids?.map(mapped) }));
      await request(log.add({ request_id: command.request_id, fingerprint, created_at: now, results: resultRows, changes: changeRows } satisfies Receipt));
    }
    return { ok: true, mode: preview ? "preview" : "applied", request_id: command.request_id, ...(preview ? { notice: "Nothing saved. Negative IDs are preview placeholders." } : {}), results: resultRows, changes: changeRows };
  });
}
