import { OPENAI_MODELS, estimateInputTokens, modelInfo, defaultEffort, PRICE_CHECKED } from "../lib/aiModels";
import { masterSkills } from "../lib/technicalSkills";
import { preserveSubprojectTitles } from "../lib/subprojectTitles";
import { profileDetails } from "../lib/profileDetails";
import { COMPANY_CATALOG } from "../data/catalog";
import resumeSkill from "../skills/resume-generation.md?raw";
import type {
  AiSettings, AiUsage, Analytics, Application, ApplicationStage, Company, CompanyState,
  CompanyUpdate, FeatureStatus, GeneratedResume, ResumeProfile, ResumeProfileUpdate,
  ResumeVersion, ResumeVersionRead, StructuredResume,
} from "../types";
import { makeZip, readStoreZip } from "../lib/resumeFiles";
import { compileResumeLatex, renderResumeLatex } from "../lib/resumeLatex";
import { normalizeStoredStructuredResume, parseStructuredResumeJson, RESUME_JSON_SCHEMA, trimLowestPriorityContent } from "../lib/resumeSchema";

const DB_NAME = "internradar-browser";
const DB_VERSION = 3;
const COMPANY_ID_ALIASES: Record<number, number> = {
  25: 26,
  118: 110,
  195: 220,
  294: 293,
  307: 293,
  330: 36,
  335: 159,
  512: 549,
};
const stages: ApplicationStage[] = ["Applied", "OA", "Interview", "Rejected", "Offer"];
const tierOrder = ["S+", "S", "A+", "A", "B+", "B", "C", "D"];
const providerModels = {
  openai: OPENAI_MODELS.map(model => model.id),
  gemini: ["gemini-3.8-flash"],
  glm: ["glm-5.3-flash"],
} as const;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";



function now() { return new Date().toISOString(); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"; }


function canonicalCompanyId(companyId: number) {
  return COMPANY_ID_ALIASES[companyId] || companyId;
}

function mergeCompanyStates(current: CompanyState | undefined, incoming: CompanyState, companyId: number): CompanyState {
  const notes = [...new Set([current?.notes, incoming.notes].filter((value): value is string => Boolean(value)))].join("\n\n");
  return {
    company_id: companyId,
    notes,
    link: current?.link || incoming.link || "",
    main_locations: current?.main_locations || incoming.main_locations || "",
    updated_at: [current?.updated_at, incoming.updated_at].filter(Boolean).sort().slice(-1)[0] || now(),
  };
}

function migrateCompanyReferences(transaction: IDBTransaction) {
  for (const storeName of ["applications", "resume_versions"]) {
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const value = cursor.value as { company_id: number };
      const companyId = canonicalCompanyId(value.company_id);
      if (companyId !== value.company_id) cursor.update({ ...value, company_id: companyId });
      cursor.continue();
    };
  }
  const stateStore = transaction.objectStore("company_states");
  const stateRequest = stateStore.openCursor();
  stateRequest.onsuccess = () => {
    const cursor = stateRequest.result;
    if (!cursor) return;
    const value = cursor.value as CompanyState;
    const companyId = canonicalCompanyId(value.company_id);
    if (companyId === value.company_id) {
      cursor.continue();
      return;
    }
    const targetRequest = stateStore.get(companyId);
    targetRequest.onsuccess = () => {
      stateStore.put(mergeCompanyStates(targetRequest.result as CompanyState | undefined, value, companyId));
      cursor.delete();
      cursor.continue();
    };
  };
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = request.result;
      if (!db.objectStoreNames.contains("company_states")) db.createObjectStore("company_states", { keyPath: "company_id" });
      if (!db.objectStoreNames.contains("resume_profile")) db.createObjectStore("resume_profile", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ai_settings")) db.createObjectStore("ai_settings", { keyPath: "id" });
      if (!db.objectStoreNames.contains("applications")) db.createObjectStore("applications", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("resume_versions")) db.createObjectStore("resume_versions", { keyPath: "id", autoIncrement: true });
      if (event.oldVersion < 2 && request.transaction) migrateCompanyReferences(request.transaction);
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
    id: 1,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    website: "",
    education: [],
    workExperiences: [],
    researchExperiences: [],
    projects: [],
    skills: { languages: [], frameworks: [], developerTools: [], libraries: [] },
    // legacy flat fields for migration
    name: "",
    education_text: "",
    experience_text: "",
    projects_text: "",
    research_text: "",
    skills_text: "",
    awards_text: "",
    other_text: "",
    updated_at: now(),
  };
}

function migrateProfileData(raw: Record<string, unknown>): ResumeProfile {
  const base = defaultProfile();
  const merged = { ...base, ...(raw as unknown as Partial<ResumeProfile>) } as ResumeProfile;
  // firstName/lastName from legacy name
  if ((!merged.firstName || !merged.lastName) && typeof raw.name === "string" && raw.name.trim()) {
    const parts = raw.name.trim().split(/\s+/);
    if (!merged.firstName) merged.firstName = parts[0] || "";
    if (!merged.lastName) merged.lastName = parts.slice(1).join(" ") || "";
  }
  // education: if new empty but legacy education_text present, create placeholder
  if (!merged.education?.length && typeof raw.education_text === "string" && raw.education_text.trim()) {
    merged.education = [{
      institution: "University",
      degree: raw.education_text.trim().split("\n")[0]?.trim() || "Degree",
      location: "",
      startDate: "",
      endDate: "",
    }];
  }
  // workExperiences: if empty but legacy experience_text present
  if (!merged.workExperiences?.length && typeof raw.experience_text === "string" && raw.experience_text.trim()) {
    merged.workExperiences = [{
      company: "Company",
      title: "Role Title",
      location: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      subprojects: [{ name: "General", details: raw.experience_text }],
    }];
  }
  // researchExperiences
  if (!merged.researchExperiences?.length && typeof raw.research_text === "string" && raw.research_text.trim()) {
    merged.researchExperiences = [{
      organization: "Research Organization",
      title: "Research Title",
      location: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      subprojects: [{ name: "Research Project", details: raw.research_text }],
    }];
  }
  // projects
  if (!merged.projects?.length && typeof raw.projects_text === "string" && raw.projects_text.trim()) {
    merged.projects = [{
      name: "Project",
      technologies: [] as string[],
      dates: "",
      details: raw.projects_text,
    }];
  }
  // skills: if new skills empty but legacy skills_text present
  const skillCount = merged.skills ? Object.values(merged.skills).flat().length : 0;
  if (!skillCount && typeof raw.skills_text === "string" && raw.skills_text.trim()) {
    const parts = raw.skills_text.split(",").map(s => s.trim()).filter(Boolean);
    merged.skills = { languages: parts.slice(0, 3), frameworks: [], developerTools: parts.slice(3), libraries: [] };
  }
  // ensure firstName/lastName fallback to name if still empty
  if (!merged.firstName && !merged.lastName && merged.name) {
    const parts = merged.name.split(/\s+/);
    merged.firstName = parts[0] || "";
    merged.lastName = parts.slice(1).join(" ") || "";
  }
  merged.workExperiences = merged.workExperiences.map(entry => ({ ...entry, subprojects: entry.subprojects.map(sub => ({ ...sub, details: profileDetails(sub) })) }));
  merged.researchExperiences = merged.researchExperiences.map(entry => ({ ...entry, subprojects: entry.subprojects.map(sub => ({ ...sub, details: profileDetails(sub) })) }));
  merged.projects = merged.projects.map(project => ({ ...project, details: profileDetails(project) }));
  merged.skillInventory = masterSkills(merged);
  return merged;
}

function defaultAiSettings(): AiSettings {
  return { provider: "openai", api_key: "", model: "gpt-5.6-luna", reasoning_effort: "low", updated_at: now() };
}

function normalizeAiSettings(value?: Partial<AiSettings> & { provider?: string }): AiSettings {
  const fallback = defaultAiSettings();
  const legacyProvider = value?.provider as string | undefined;
  const provider = legacyProvider === "gemini" ? "gemini" : legacyProvider === "glm" || legacyProvider === "glm-compatible" ? "glm" : "openai";
  const allowedModels = providerModels[provider] as readonly string[];
  const selectedModel = typeof value?.model === "string" && value.model ? value.model : allowedModels[0];
  return {
    provider,
    api_key: typeof value?.api_key === "string" ? value.api_key : "",
    model: selectedModel,
    reasoning_effort: value?.reasoning_effort && modelInfo(selectedModel)?.efforts.includes(value.reasoning_effort) ? value.reasoning_effort : defaultEffort(selectedModel),
    updated_at: typeof value?.updated_at === "string" ? value.updated_at : fallback.updated_at,
  };
}

function validatedAiSettings(value: Omit<AiSettings, "updated_at">): Omit<AiSettings, "updated_at"> {
  const allowedModels = providerModels[value.provider] as readonly string[];
  if (!allowedModels.includes(value.model)) throw new Error("Select a model from the provider list");
  const effort = value.reasoning_effort ?? defaultEffort(value.model);
  if (value.provider === "openai" && !modelInfo(value.model)?.efforts.includes(effort)) throw new Error("Unsupported reasoning strength for this model");
  return { provider: value.provider, model: value.model, api_key: value.api_key, reasoning_effort: effort };
}
async function profile() {
  const existing = await get<ResumeProfile>("resume_profile", 1);
  if (existing) {
    const migrated = migrateProfileData(existing as unknown as Record<string, unknown>);
    // persist migration if needed
    const needsPersist = JSON.stringify(existing) !== JSON.stringify(migrated);
    if (needsPersist) return put<ResumeProfile>("resume_profile", { ...migrated, id: 1, updated_at: now() });
    return { ...defaultProfile(), ...migrated, id: 1 };
  }
  return put("resume_profile", defaultProfile());
}

async function aiSettings() {
  const existing = await get<(Partial<AiSettings> & { id: number; provider?: string })>("ai_settings", 1);
  return { id: 1, ...normalizeAiSettings(existing) };
}
async function applications(companyId?: number) {
  const items = await all<Application>("applications");
  return items.filter(item => !companyId || item.company_id === companyId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

type StoredResumeVersion = Omit<ResumeVersion, "structured_resume" | "tex_source"> & {
  structured_resume: unknown;
  tex_source?: string;
};

function hydrateResumeVersion(version: StoredResumeVersion): ResumeVersion {
  const structuredResume = normalizeStoredStructuredResume(version.structured_resume);
  return {
    ...version,
    structured_resume: structuredResume,
    tex_source: typeof version.tex_source === "string" && version.tex_source.trim()
      ? version.tex_source
      : renderResumeLatex(structuredResume),
  };
}

async function versions(applicationId?: number) {
  const items = (await all<StoredResumeVersion>("resume_versions")).map(hydrateResumeVersion);
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

async function responseError(response: Response) {
  const detail = await response.text();
  throw new Error(`AI request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`);
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GLM_CHAT_URL = "https://api.z.ai/api/paas/v4/chat/completions";
async function callGemini(settings: AiSettings, prompt: string, strictResume = false) {
  const response = await fetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(settings.model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": settings.api_key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "high" },
        ...(strictResume ? { responseJsonSchema: RESUME_JSON_SCHEMA } : {}),
      },
    }),
  });
  if (!response.ok) return responseError(response);
  const body = await response.json();
  return body.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
}

async function callGlm(settings: AiSettings, messages: Array<{ role: "system" | "user"; content: string }>) {
  const response = await fetch(GLM_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.api_key}` },
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: false,
      thinking: { type: "enabled" },
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) return responseError(response);
  const body = await response.json();
  return body.choices?.[0]?.message?.content || "";
}


async function callResumeAi(settings: AiSettings, userPrompt: string): Promise<{ resume: StructuredResume; usage?: AiUsage }> {
  if (settings.provider !== "openai") {
    const raw = settings.provider === "gemini"
      ? await callGemini(settings, `${resumeSkill}\n\n${userPrompt}`, true)
      : await callGlm(settings, [{ role: "system", content: `${resumeSkill}\n\nOutput JSON Schema:\n${JSON.stringify(RESUME_JSON_SCHEMA)}` }, { role: "user", content: userPrompt }]);
    return { resume: parseStructuredResumeJson(raw) };
  }
  const effort = settings.reasoning_effort ?? defaultEffort(settings.model);
  if (!modelInfo(settings.model)?.efforts.includes(effort)) throw new Error("Unsupported model or reasoning setting.");
  const payload = {
    model: settings.model,
    input: [{ role: "system", content: resumeSkill }, { role: "user", content: userPrompt }],
    reasoning: { effort },
    text: { format: { type: "json_schema", name: "structured_resume", strict: true, schema: RESUME_JSON_SCHEMA } },
  };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${settings.api_key}` };
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST", headers,
    body: JSON.stringify({ ...payload, service_tier: "default", store: false }),
  });
  if (!response.ok) { await responseError(response); throw new Error("AI request failed; no automatic retry was made"); }
  const body = await response.json();
  const rates = modelInfo(settings.model)!;
  const reported = body.usage;
  let usage: AiUsage | undefined;
  if (Number.isSafeInteger(reported?.input_tokens) && reported.input_tokens >= 0 && Number.isSafeInteger(reported?.output_tokens) && reported.output_tokens >= 0) {
    usage = { input_tokens: reported.input_tokens, output_tokens: reported.output_tokens,
      reasoning_tokens: reported.output_tokens_details?.reasoning_tokens || 0,
      estimated_usd: (reported.input_tokens * rates.input + reported.output_tokens * rates.output) / 1e6,
      price_checked: PRICE_CHECKED };
  }
  const charge = usage ? ` Reported-token cost estimate: $${usage.estimated_usd.toFixed(4)}.` : " Usage unavailable; the request may still have been charged.";
  if (body.status === "incomplete") throw new Error(`The provider returned an incomplete response (${body.incomplete_details?.reason || "reason unavailable"}).${charge} No automatic retry was made.`);
  const raw = typeof body.output_text === "string" ? body.output_text : body.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || []).find((item: { type?: string }) => item.type === "output_text")?.text || "";
  try { return { resume: parseStructuredResumeJson(raw), usage }; }
  catch (error) { throw new Error(`${error instanceof Error ? error.message : "Invalid JSON"} No automatic retry was made.${charge}`); }
}
// Archived bullet/highlight fields remain in storage, but only current raw notes go to AI.
function profileSource(profileData: ResumeProfileUpdate) {
  const sourceEntry = (entry: ResumeProfile["workExperiences"][number] | ResumeProfile["researchExperiences"][number]) => ({
    ...entry, subprojects: entry.subprojects.map(sub => ({ name: sub.omitTitle ? "" : sub.name, omitTitle: !!sub.omitTitle, details: profileDetails(sub) })),
  });
  const { experience_text, research_text, projects_text, skills, skills_text, ...source } = profileData;
  return { ...source, skillInventory: masterSkills(profileData),
    workExperiences: profileData.workExperiences.map(sourceEntry),
    researchExperiences: profileData.researchExperiences.map(sourceEntry),
    projects: profileData.projects.map(({ bullets, ...project }) => ({ ...project, details: profileDetails({ ...project, bullets }) })),
  };
}
export function estimateResumeInput(profileData: ResumeProfileUpdate) {
  return estimateInputTokens(resumeSkill + JSON.stringify(RESUME_JSON_SCHEMA) + JSON.stringify(profileSource(profileData), null, 2));
}

function generationPrompt(profileData: ResumeProfile, app: Application, extraInstructions: string) {
  return `Create the one-page structured resume content for this application. The fixed renderer owns all layout.\n\nCompany: ${companyName(app.company_id)}\n\nMaster resume profile (factual basis for experience; skill inventory is non-exhaustive, and Technical Skills may be supplemented from the JD):\n${JSON.stringify(profileSource(profileData), null, 2)}\n\nTarget application and job description:\n${JSON.stringify(app, null, 2)}\n\nExtra user instructions:\n${extraInstructions || "None"}`;
}

async function renderOnePageResume(initial: StructuredResume, profileData: ResumeProfile) {
  let structuredResume = preserveSubprojectTitles(initial, profileData);
  let texSource = renderResumeLatex(structuredResume);
  let compilation = await compileResumeLatex(texSource);
  // Page fitting is local only: no extra paid AI calls, including after a failure.
  for (let step = 0; step < 64 && compilation.pageCount > 1; step += 1) {
    const trimmed = trimLowestPriorityContent(structuredResume);
    if (!trimmed) break;
    structuredResume = trimmed;
    texSource = renderResumeLatex(structuredResume);
    compilation = await compileResumeLatex(texSource);
  }
  if (compilation.pageCount !== 1) throw new Error("Local fitting could not produce one page. The AI request may have been charged; no automatic retry was made.");
  return { structuredResume, texSource, pdfFile: compilation.pdfFile };
}
async function generateResumeVersion(applicationId: number, extraInstructions: string) {
  const app = await get<Application>("applications", applicationId);
  if (!app) throw new Error("Application not found");
  const settings = await aiSettings();
  if (!settings.api_key || !settings.model) throw new Error("Save AI settings before generating resumes");
  const profileData = await profile();
  const generated = await callResumeAi(settings, generationPrompt(profileData, app, extraInstructions));
  let rendered;
  try { rendered = await renderOnePageResume(generated.resume, profileData); }
  catch (error) {
    const charge = generated.usage ? ` Estimated cost: US$${generated.usage.estimated_usd.toFixed(4)}.` : " Cost unavailable.";
    throw new Error(`${error instanceof Error ? error.message : "PDF generation failed"}${charge}`);
  }
  const existing = await versions(applicationId);
  const version_number = existing.length ? Math.max(...existing.map(item => item.version_number)) + 1 : 1;
  return add<Partial<ResumeVersion>>("resume_versions", {
    application_id: applicationId,
    company_id: app.company_id,
    version_number,
    structured_resume: rendered.structuredResume,
    ai_usage: generated.usage,
    reasoning_effort: settings.reasoning_effort ?? defaultEffort(settings.model),
    tex_source: rendered.texSource,
    pdf_file: rendered.pdfFile,
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
    ai_usage: version.ai_usage,
    reasoning_effort: version.reasoning_effort,
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
      generated_latex: version.tex_source,
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
    files[`${path}.tex`] = version.tex_source;
    const { pdf_file: _pdf, docx_file: _legacyDocx, tex_source: _tex, ...rest } = version;
    return { ...rest, pdf_path: `${path}.pdf`, tex_path: `${path}.tex` };
  });
  files["data.json"] = JSON.stringify({ company_states: states, resume_profile: profileData, ai_settings: { ...settings, api_key: "" }, applications: apps, resume_versions: metadata }, null, 2);
  return makeZip(files);
}

async function importBackup(file: File) {
  const files = await readStoreZip(file);
  const dataBlob = files["data.json"];
  if (!dataBlob) throw new Error("Backup is missing data.json");
  const data = JSON.parse(await dataBlob.text()) as {
    company_states?: CompanyState[];
    resume_profile?: ResumeProfile;
    applications?: Application[];
    resume_versions?: Array<Record<string, unknown> & {
      company_id: number;
      structured_resume: unknown;
      pdf_path?: string;
      tex_path?: string;
      docx_path?: string;
      tex_source?: string;
    }>;
  };
  const importedVersions = await Promise.all((data.resume_versions || []).map(async meta => {
    const { pdf_path: pdfPath, tex_path: texPath, docx_path: _legacyDocxPath, ...version } = meta;
    const pdfFile = pdfPath ? files[pdfPath] : undefined;
    if (!pdfFile) throw new Error(`Backup is missing resume PDF: ${pdfPath || "unknown path"}`);
    const structuredResume = normalizeStoredStructuredResume(version.structured_resume);
    const texSource = texPath && files[texPath]
      ? await files[texPath].text()
      : typeof version.tex_source === "string" && version.tex_source.trim()
        ? version.tex_source
        : renderResumeLatex(structuredResume);
    return {
      ...version,
      company_id: canonicalCompanyId(Number(version.company_id)),
      structured_resume: structuredResume,
      tex_source: texSource,
      pdf_file: pdfFile,
    };
  }));

  await tx(["company_states", "resume_profile", "applications", "resume_versions"], "readwrite", async (_, transaction) => {
    for (const store of ["company_states", "resume_profile", "applications", "resume_versions"]) await req(transaction.objectStore(store).clear());
    const importedStates = new Map<number, CompanyState>();
    for (const state of data.company_states || []) {
      const companyId = canonicalCompanyId(state.company_id);
      importedStates.set(companyId, mergeCompanyStates(importedStates.get(companyId), state, companyId));
    }
    for (const state of importedStates.values()) await req(transaction.objectStore("company_states").put(state));
    if (data.resume_profile) await req(transaction.objectStore("resume_profile").put(data.resume_profile));
    for (const app of data.applications || []) {
      await req(transaction.objectStore("applications").put({ ...app, company_id: canonicalCompanyId(app.company_id) }));
    }
    for (const version of importedVersions) await req(transaction.objectStore("resume_versions").put(version));
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
  saveAiSettings: (settings: Omit<AiSettings, "updated_at">) => put("ai_settings", { ...validatedAiSettings(settings), id: 1, updated_at: now() }),
  removeAiKey: async () => {
    const settings = await aiSettings();
    return put("ai_settings", { ...settings, api_key: "", updated_at: now() });
  },
  testAiConnection: async (settings: AiSettings) => {
    if (!settings.api_key || !settings.model) throw new Error("API key and model are required");
    const checked = normalizeAiSettings(settings);
    validatedAiSettings(checked);
    if (checked.provider === "gemini") { await callGemini(checked, 'Return JSON only: {"ok":true}'); return true; }
    if (checked.provider === "glm") { await callGlm(checked, [{ role: "user", content: 'Return JSON only: {"ok":true}' }]); return true; }
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(checked.model)}`, { headers: { Authorization: `Bearer ${checked.api_key}` } });
    if (!response.ok) await responseError(response);    return true;
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
  getResumeVersion: async (id: number) => { const item = await get<StoredResumeVersion>("resume_versions", id); return item ? hydrateResumeVersion(item) : undefined; },
  deleteResumeVersion: (id: number) => del("resume_versions", id),
  resumes: resumeReads,
  companyResumes: async (companyId: number) => (await resumeReads()).filter(item => item.company_id === companyId),
  deleteResume: (id: number) => del("resume_versions", id),
  exportBackup,
  importBackup,
};
