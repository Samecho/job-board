import { COMPANY_CATALOG } from "../data/catalog";
import resumeSkill from "../skills/resume-generation.md?raw";
import type {
  AiSettings, Analytics, Application, ApplicationStage, Company, CompanyState,
  CompanyUpdate, FeatureStatus, GeneratedResume, ResumeProfile, ResumeProfileUpdate,
  ResumeVersion, ResumeVersionRead, StructuredResume,
} from "../types";
import { makeZip, readStoreZip, renderResumeDocx, renderResumePdf } from "../lib/resumeFiles";

const DB_NAME = "internradar-browser";
const DB_VERSION = 1;
const stages: ApplicationStage[] = ["Applied", "OA", "Interview", "Rejected", "Offer"];
const tierOrder = ["S+", "S", "A+", "A", "B+", "B", "C", "D"];

function now() { return new Date().toISOString(); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("company_states")) db.createObjectStore("company_states", { keyPath: "company_id" });
      if (!db.objectStoreNames.contains("resume_profile")) db.createObjectStore("resume_profile", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ai_settings")) db.createObjectStore("ai_settings", { keyPath: "id" });
      if (!db.objectStoreNames.contains("applications")) db.createObjectStore("applications", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("resume_versions")) db.createObjectStore("resume_versions", { keyPath: "id", autoIncrement: true });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function tx<T>(stores: string[], mode: IDBTransactionMode, run: (db: IDBDatabase, tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  try {
    const transaction = db.transaction(stores, mode);
    const result = await run(db, transaction);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return result;
  } finally { db.close(); }
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function all<T>(store: string): Promise<T[]> {
  return tx([store], "readonly", (_, transaction) => req<T[]>(transaction.objectStore(store).getAll()));
}

async function get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return tx([store], "readonly", (_, transaction) => req<T | undefined>(transaction.objectStore(store).get(key)));
}

async function put<T>(store: string, value: T): Promise<T> {
  return tx([store], "readwrite", (_, transaction) => req(transaction.objectStore(store).put(value)).then(() => value));
}

async function add<T extends object>(store: string, value: T): Promise<T & { id: number }> {
  return tx([store], "readwrite", async (_, transaction) => {
    const id = await req<IDBValidKey>(transaction.objectStore(store).add(value));
    return { ...value, id: Number(id) };
  });
}

async function del(store: string, key: IDBValidKey) {
  await tx([store], "readwrite", (_, transaction) => req(transaction.objectStore(store).delete(key)));
}

function defaultProfile(): ResumeProfile {
  return {
    id: 1, name: "", email: "", phone: "", location: "", linkedin: "", github: "", website: "",
    education_text: "", experience_text: "", projects_text: "", research_text: "", skills_text: "", awards_text: "", other_text: "",
    updated_at: now(),
  };
}

function defaultAiSettings(): AiSettings {
  return { provider: "openai-compatible", api_key: "", model: "gpt-4.1-mini", base_url: "https://api.openai.com/v1", updated_at: now() };
}

async function profile() {
  const existing = await get<ResumeProfile>("resume_profile", 1);
  if (existing) return { ...defaultProfile(), ...existing };
  return put("resume_profile", defaultProfile());
}

async function aiSettings() {
  const existing = await get<AiSettings & { id: number }>("ai_settings", 1);
  if (existing) return existing;
  return { id: 1, ...defaultAiSettings() };
}

async function applications(companyId?: number) {
  const items = await all<Application>("applications");
  return items.filter(item => !companyId || item.company_id === companyId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function versions(applicationId?: number) {
  const items = await all<ResumeVersion>("resume_versions");
  return items.filter(item => !applicationId || item.application_id === applicationId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function companyName(companyId: number) {
  return COMPANY_CATALOG.find(company => company.id === companyId)?.name || "Company";
}

async function companies(): Promise<Company[]> {
  const [states, apps, resumeVersions] = await Promise.all([
    all<CompanyState>("company_states"), applications(), versions(),
  ]);
  const stateMap = new Map(states.map(state => [state.company_id, state]));
  const appCounts = new Map<number, number>();
  const resumeCounts = new Map<number, number>();
  apps.forEach(app => appCounts.set(app.company_id, (appCounts.get(app.company_id) || 0) + 1));
  resumeVersions.forEach(version => resumeCounts.set(version.company_id, (resumeCounts.get(version.company_id) || 0) + 1));
  return COMPANY_CATALOG.map(company => {
    const state = stateMap.get(company.id);
    const application_count = appCounts.get(company.id) || 0;
    return {
      ...company,
      main_locations: state?.main_locations ?? company.main_locations,
      notes: state?.notes ?? "",
      link: state?.link ?? company.link,
      status: application_count > 0 ? "Applied" as const : "Not Applied" as const,
      application_count,
      resume_count: resumeCounts.get(company.id) || 0,
    };
  }).sort((a, b) => (tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)) || a.name.localeCompare(b.name));
}

async function company(id: number) {
  const found = (await companies()).find(item => item.id === id);
  if (!found) throw new Error("Company not found");
  return found;
}

async function updateCompany(id: number, data: CompanyUpdate) {
  const current = await company(id);
  await put<CompanyState>("company_states", {
    company_id: id,
    notes: data.notes ?? current.notes,
    link: data.link ?? current.link,
    main_locations: data.main_locations ?? current.main_locations,
    updated_at: now(),
  });
  return company(id);
}

async function analytics(): Promise<Analytics> {
  const [items, apps, resumeVersions] = await Promise.all([companies(), applications(), versions()]);
  const stageCounts = Object.fromEntries(stages.map(stage => [stage, 0])) as Record<ApplicationStage, number>;
  apps.forEach(app => { stageCounts[app.application_stage] += 1; });
  const tier_counts: Record<string, number> = {};
  tierOrder.forEach(tier => { tier_counts[tier] = items.filter(company => company.tier === tier).length; });
  const companiesWithResume = new Set(resumeVersions.map(version => version.company_id));
  return {
    total_companies: items.length,
    applied_count: items.filter(company => company.application_count > 0).length,
    total_applications: apps.length,
    applications_by_stage: stageCounts,
    status_counts: { Applied: items.filter(company => company.application_count > 0).length, "Not Applied": items.filter(company => company.application_count === 0).length },
    tier_counts,
    saved_resume_count: resumeVersions.length,
    companies_with_resumes: companiesWithResume.size,
    recent_resumes: resumeVersions.slice(0, 6).map(version => ({
      id: version.id, company_id: version.company_id, company_name: companyName(version.company_id),
      resume_name: `Version ${version.version_number}`, job_title: apps.find(app => app.id === version.application_id)?.job_title || "", created_at: version.created_at,
    })),
  };
}

async function callOpenAiCompatible(settings: AiSettings, messages: Array<{ role: string; content: string }>) {
  const response = await fetch(`${settings.base_url.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.api_key}` },
    body: JSON.stringify({ model: settings.model, messages, temperature: 0.2, response_format: { type: "json_object" } }),
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const body = await response.json();
  return body.choices?.[0]?.message?.content || "";
}

async function callGemini(settings: AiSettings, prompt: string) {
  const base = settings.base_url || "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(`${base.replace(/\/$/, "")}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.api_key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }),
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const body = await response.json();
  return body.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function parseStructuredResume(text: string): StructuredResume {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as StructuredResume;
  if (!parsed.header || !Array.isArray(parsed.education) || !Array.isArray(parsed.experience) || !Array.isArray(parsed.projects) || !Array.isArray(parsed.skills)) {
    throw new Error("AI response did not match the resume JSON schema");
  }
  return parsed;
}

function generationPrompt(profileData: ResumeProfile, app: Application, extraInstructions: string) {
  return `Template: Modern Engineering ATS\n\nMaster resume profile:\n${JSON.stringify(profileData, null, 2)}\n\nApplication:\n${JSON.stringify(app, null, 2)}\n\nExtra instructions:\n${extraInstructions || "None"}`;
}

async function generateResumeVersion(applicationId: number, extraInstructions: string) {
  const app = await get<Application>("applications", applicationId);
  if (!app) throw new Error("Application not found");
  const settings = await aiSettings();
  if (!settings.api_key || !settings.model) throw new Error("Save AI settings before generating resumes");
  const profileData = await profile();
  const userPrompt = generationPrompt(profileData, app, extraInstructions);
  const raw = settings.provider === "gemini"
    ? await callGemini(settings, `${resumeSkill}\n\n${userPrompt}`)
    : await callOpenAiCompatible(settings, [{ role: "system", content: resumeSkill }, { role: "user", content: userPrompt }]);
  const structured = parseStructuredResume(raw);
  const existing = await versions(applicationId);
  const version_number = existing.length ? Math.max(...existing.map(item => item.version_number)) + 1 : 1;
  const [pdf_file, docx_file] = await Promise.all([renderResumePdf(structured), renderResumeDocx(structured)]);
  return add<Partial<ResumeVersion>>("resume_versions", {
    application_id: applicationId,
    company_id: app.company_id,
    version_number,
    structured_resume: structured,
    pdf_file,
    docx_file,
    provider: settings.provider,
    model: settings.model,
    created_at: now(),
  } as ResumeVersion);
}

function versionRead(version: ResumeVersion, app?: Application): ResumeVersionRead {
  return {
    id: version.id,
    application_id: version.application_id,
    company_id: version.company_id,
    company_name: companyName(version.company_id),
    job_title: app?.job_title || "",
    version_number: version.version_number,
    structured_resume: version.structured_resume,
    provider: version.provider,
    model: version.model,
    created_at: version.created_at,
  };
}

async function resumeReads(): Promise<GeneratedResume[]> {
  const [resumeVersions, apps] = await Promise.all([versions(), applications()]);
  return resumeVersions.map(version => {
    const app = apps.find(item => item.id === version.application_id);
    return {
      ...versionRead(version, app),
      resume_name: `${companyName(version.company_id)} ${app?.job_title || "Resume"} v${version.version_number}`,
      jd_text: app?.job_description || "",
      generated_latex: JSON.stringify(version.structured_resume, null, 2),
      notes: app?.notes || "",
      updated_at: version.created_at,
    };
  });
}

async function exportBackup() {
  const [states, profileData, settings, apps, resumeVersions] = await Promise.all([
    all<CompanyState>("company_states"), profile(), aiSettings(), applications(), versions(),
  ]);
  const files: Record<string, Blob | string> = {};
  const metadata = resumeVersions.map(version => {
    const app = apps.find(item => item.id === version.application_id);
    const path = `resumes/${slug(companyName(version.company_id))}/${slug(app?.job_title || "application")}/v${version.version_number}`;
    files[`${path}.pdf`] = version.pdf_file;
    files[`${path}.docx`] = version.docx_file;
    const { pdf_file: _pdf, docx_file: _docx, ...rest } = version;
    return { ...rest, pdf_path: `${path}.pdf`, docx_path: `${path}.docx` };
  });
  files["data.json"] = JSON.stringify({ company_states: states, resume_profile: profileData, ai_settings: { ...settings, api_key: "" }, applications: apps, resume_versions: metadata }, null, 2);
  return makeZip(files);
}

async function importBackup(file: File) {
  const files = await readStoreZip(file);
  const dataBlob = files["data.json"];
  if (!dataBlob) throw new Error("Backup is missing data.json");
  const data = JSON.parse(await dataBlob.text());
  await tx(["company_states", "resume_profile", "applications", "resume_versions"], "readwrite", async (_, transaction) => {
    for (const store of ["company_states", "resume_profile", "applications", "resume_versions"]) await req(transaction.objectStore(store).clear());
    for (const state of data.company_states || []) await req(transaction.objectStore("company_states").put(state));
    if (data.resume_profile) await req(transaction.objectStore("resume_profile").put(data.resume_profile));
    for (const app of data.applications || []) await req(transaction.objectStore("applications").put(app));
    for (const meta of data.resume_versions || []) {
      const { pdf_path, docx_path, ...version } = meta;
      await req(transaction.objectStore("resume_versions").put({ ...version, pdf_file: files[pdf_path], docx_file: files[docx_path] }));
    }
  });
}

export const api = {
  companies,
  company,
  updateCompany,
  analytics,
  profile,
  updateProfile: (data: ResumeProfileUpdate) => put("resume_profile", { id: 1, ...data, updated_at: now() }),
  features: async (): Promise<FeatureStatus> => {
    const settings = await aiSettings();
    return { ai_enabled: true, ai_configured: Boolean(settings.api_key && settings.model) };
  },
  aiSettings,
  saveAiSettings: (settings: Omit<AiSettings, "updated_at">) => put("ai_settings", { ...settings, id: 1, updated_at: now() }),
  removeAiKey: async () => {
    const settings = await aiSettings();
    return put("ai_settings", { ...settings, api_key: "", updated_at: now() });
  },
  testAiConnection: async (settings: AiSettings) => {
    if (!settings.api_key || !settings.model) throw new Error("API key and model are required");
    if (settings.provider === "gemini") await callGemini(settings, "Return JSON only: {\"ok\":true}");
    else await callOpenAiCompatible(settings, [{ role: "user", content: "Return JSON only: {\"ok\":true}" }]);
    return true;
  },
  applications,
  createApplication: (data: { company_id: number; job_title: string; job_description: string; notes: string }) => add<Omit<Application, "id">>("applications", { ...data, application_stage: "Applied", created_at: now(), updated_at: now() } as Application),
  updateApplication: async (id: number, data: Partial<Application>) => {
    const current = await get<Application>("applications", id);
    if (!current) throw new Error("Application not found");
    return put("applications", { ...current, ...data, id, updated_at: now() });
  },
  deleteApplication: async (id: number) => {
    const children = await versions(id);
    await Promise.all(children.map(child => del("resume_versions", child.id)));
    await del("applications", id);
  },
  generateResumeVersion,
  resumeVersions: async (applicationId: number) => {
    const [app, items] = await Promise.all([get<Application>("applications", applicationId), versions(applicationId)]);
    return items.map(item => versionRead(item, app));
  },
  getResumeVersion: (id: number) => get<ResumeVersion>("resume_versions", id),
  deleteResumeVersion: (id: number) => del("resume_versions", id),
  resumes: resumeReads,
  companyResumes: async (companyId: number) => (await resumeReads()).filter(item => item.company_id === companyId),
  deleteResume: (id: number) => del("resume_versions", id),
  exportBackup,
  importBackup,
};
