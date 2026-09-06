import { OPENAI_MODELS, defaultEffort, modelInfo, priceLabel, scenarioCost } from "./lib/aiModels";
import type { ReasoningEffort } from "./lib/aiModels";
import { getGenerationTasks, subscribeGeneration, dismissGeneration } from "./lib/resumeGeneration";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BarChart3, Download, ExternalLink, FileText, Grid2X2, LayoutDashboard,
  List, MapPin, Radar, Search, Upload,
} from "lucide-react";
import { api, estimateResumeInput } from "./api/client";
import { CompanyModal } from "./components/CompanyModal";
import { Logo } from "./components/Logo";
import { ProfileEditor } from "./components/ProfileEditor";
import { ResumeModal } from "./components/ResumeModal";
import { downloadBlob } from "./lib/resumeFiles";
import type {
  AiProvider, AiSettings, Analytics, Company, CompanyStatus, CompanyUpdate,
  FeatureStatus, GeneratedResume, ResumeProfile, ResumeProfileUpdate,
} from "./types";

type Page = "overview" | "analytics" | "resume";
const statuses: CompanyStatus[] = ["Not Applied", "Applied"];
const tierOrder = ["S+", "S", "A+", "A", "B+", "B", "C", "D"];
const providerOptions: Array<{ value: AiProvider; label: string; models: Array<{ value: string; label: string }> }> = [
  {
    value: "openai",
    label: "OpenAI",
    models: OPENAI_MODELS.map(model => ({ value: model.id, label: priceLabel(model) })),
  },
  { value: "gemini", label: "Gemini", models: [{ value: "gemini-3.8-flash", label: "Gemini 3.8 Flash" }] },
  { value: "glm", label: "GLM", models: [{ value: "glm-5.3-flash", label: "GLM-5.3-Flash" }] },
];

function InternBadge() {
  return <span className="intern-badge" title="Recurring internship or co-op hiring">Intern</span>;
}

function useOverviewFilters() {
  const [view, setView] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [category, setCategory] = useState("");
  const [internHiring, setInternHiring] = useState("");
  const [sort, setSort] = useState<"tier" | "company">("tier");
  const [descending, setDescending] = useState(false);
  return { view, setView, search, setSearch, status, setStatus, tier, setTier, category, setCategory, internHiring, setInternHiring, sort, setSort, descending, setDescending };
}

function Overview({ companies, onUpdate, onEdit, onResume, onQuickApply, filters }: {
  filters: ReturnType<typeof useOverviewFilters>;
  companies: Company[];
  onUpdate: (company: Company, data: CompanyUpdate) => Promise<void>;
  onEdit: (company: Company) => void;
  onResume: (company: Company) => void;
  onQuickApply: (company: Company) => Promise<void>;
}) {
  const { view, setView, search, setSearch, status, setStatus, tier, setTier, category, setCategory, internHiring, setInternHiring, sort, setSort, descending, setDescending } = filters;
  const tiers = useMemo(() => tierOrder.filter(value => companies.some(company => company.tier === value)), [companies]);
  const categories = useMemo(() => [...new Set(companies.map(company => company.category))].sort(), [companies]);
  const filtered = companies.filter(company =>
    (!search || `${company.name} ${company.category} ${company.main_locations}`.toLowerCase().includes(search.toLowerCase())) &&
    (!status || company.status === status) && (!tier || company.tier === tier) &&
    (!category || company.category === category) &&
    (!internHiring || company.intern_friendly === (internHiring === "yes"))
  );
  const sorted = [...filtered].sort((left, right) => {
    const tierRank = (value: string) => {
      const rank = tierOrder.indexOf(value);
      return rank === -1 ? tierOrder.length : rank;
    };
    const result = sort === "company" ? left.name.localeCompare(right.name) : (tierRank(left.tier) - tierRank(right.tier)) || left.name.localeCompare(right.name);
    return descending ? -result : result;
  });
  const changeSort = (next: "tier" | "company") => {
    if (sort === next) setDescending(value => !value);
    else { setSort(next); setDescending(false); }
  };
  const statusControl = (company: Company) => <label className="applied-toggle"><input type="checkbox" checked={company.application_count > 0} onChange={() => onQuickApply(company)} /><span>{company.application_count ? `Applied (${company.application_count})` : "Not Applied"}</span></label>;
  return <section className="content-panel">
    <div className="toolbar"><div><span className="eyebrow">{sorted.length} companies</span><h2>Company tracker</h2></div><div className="view-toggle"><button className={view === "table" ? "active" : ""} onClick={() => setView("table")}><List size={17} /> Table</button><button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}><Grid2X2 size={17} /> Cards</button></div></div>
    <div className="filters simple-filters"><label className="search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search companies, categories, locations..." /></label><select value={tier} onChange={event => setTier(event.target.value)}><option value="">All tiers</option>{tiers.map(value => <option key={value}>{value}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select><select value={internHiring} onChange={event => setInternHiring(event.target.value)}><option value="">All intern hiring</option><option value="yes">Regular intern hiring</option><option value="no">Limited or uncommon</option></select></div>
    {view === "table" ? <div className="table-wrap overview-table"><table><colgroup><col className="col-tier" /><col className="col-company" /><col className="col-location" /><col className="col-status" /><col className="col-link" /><col className="col-resume" /><col className="col-notes" /></colgroup><thead><tr><th><button className={sort === "tier" ? "active" : ""} onClick={() => changeSort("tier")}>Tier {sort === "tier" ? (descending ? "↓" : "↑") : ""}</button></th><th><button className={sort === "company" ? "active" : ""} onClick={() => changeSort("company")}>Company {sort === "company" ? (descending ? "↓" : "↑") : ""}</button></th><th>Location</th><th>Status</th><th>Link</th><th>Resume</th><th>Notes</th></tr></thead><tbody>{sorted.map(company => <tr key={company.id} onDoubleClick={() => onEdit(company)}><td><span className={`tier tier-${company.tier}`}>{company.tier}</span></td><td><div className="company-cell"><Logo name={company.name} domain={company.domain} url={company.logo_url} /><div><strong>{company.name}</strong><span className="company-meta">{company.category}{company.intern_friendly && <InternBadge />}</span></div></div></td><td><span className="location-cell"><MapPin size={14} />{company.main_locations || "Not listed"}</span></td><td>{statusControl(company)}</td><td>{company.link ? <a className="button ghost compact-button" href={company.link} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a> : <button className="button ghost compact-button" onClick={() => onEdit(company)}>Add link</button>}</td><td><button className="button primary compact-button" onClick={() => onResume(company)}>Resume{company.resume_count ? ` (${company.resume_count})` : ""}</button></td><td><button className="table-note edit-note" title={company.notes} onClick={() => onEdit(company)}>{company.notes || "Add notes"}</button></td></tr>)}</tbody></table></div>
      : <div className="company-grid">{sorted.map(company => <article className="company-card simple-card" key={company.id}><div className="card-top"><Logo name={company.name} domain={company.domain} url={company.logo_url} size={48} /><span className={`tier tier-${company.tier}`}>{company.tier}</span></div><div className="card-title"><div><h3>{company.name}</h3><span className="company-meta">{company.category}{company.intern_friendly && <InternBadge />}</span></div></div><div className="card-facts"><div><span>Location</span><strong>{company.main_locations || "Not listed"}</strong></div></div><div className="card-applied">{statusControl(company)}</div><button className="notes-preview edit-note" onClick={() => onEdit(company)}>{company.notes || "Add notes for this company."}</button><div className="card-actions"><button className="button ghost" onClick={() => onEdit(company)}>Edit</button>{company.link ? <a className="button ghost" href={company.link} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a> : <button className="button ghost" onClick={() => onEdit(company)}>Add link</button>}<button className="button primary" onClick={() => onResume(company)}>Resume{company.resume_count ? ` (${company.resume_count})` : ""}</button></div></article>)}</div>}
  </section>;
}

function AnalyticsPage({ analytics }: { analytics: Analytics }) {
  const cards = [["Total companies", analytics.total_companies], ["Applied companies", analytics.applied_count], ["Applications", analytics.total_applications], ["Resume versions", analytics.saved_resume_count], ["Companies with resumes", analytics.companies_with_resumes]];
  const stages = ["Applied", "OA", "Interview", "Rejected", "Offer"] as const;
  return <><div className="summary-grid personal-summary">{cards.map(([label, value]) => <div className="summary-card" key={label}><div><span>{label}</span><strong>{value}</strong></div></div>)}</div><div className="analytics-layout"><section className="panel"><div className="panel-head"><h2>Applications by stage</h2></div><div className="funnel">{stages.map(value => <div key={value}><span>{value}</span><div><i style={{ width: `${Math.max(2, (analytics.applications_by_stage[value] || 0) / Math.max(1, analytics.total_applications) * 100)}%` }} /></div><strong>{analytics.applications_by_stage[value] || 0}</strong></div>)}</div></section><section className="panel"><div className="panel-head"><h2>Companies by tier</h2></div><div className="tier-stats">{tierOrder.map(tier => <div key={tier}><span className={`tier tier-${tier}`}>{tier}</span><strong>{analytics.tier_counts[tier] || 0}</strong><small>companies</small></div>)}</div></section><section className="panel"><div className="panel-head"><h2>Recent resume versions</h2></div><div className="recent-list">{analytics.recent_resumes.length ? analytics.recent_resumes.map(item => <div key={item.id}><strong>{item.resume_name}</strong><span>{item.company_name} · {item.job_title || "No job title"} · {new Date(item.created_at).toLocaleDateString()}</span></div>) : <p>No resume versions yet.</p>}</div></section></div></>;
}

function AiSettingsPanel({ settings, profile, onSave }: { settings: AiSettings; profile: ResumeProfileUpdate; onSave: () => Promise<void> }) {
  const estimatedInput = useMemo(() => estimateResumeInput(profile), [profile]);
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState("");
  useEffect(() => setForm(settings), [settings.updated_at]);
  const models = providerOptions.find(option => option.value === form.provider)?.models || providerOptions[0].models;
  const setProvider = (provider: AiProvider) => {
    const model = providerOptions.find(option => option.value === provider)?.models[0].value || "gpt-5.6-sol";
    setForm(current => ({ ...current, provider, model, reasoning_effort: defaultEffort(model) }));
    setMessage("");
  };
  const save = async () => { try { await api.saveAiSettings(form); setMessage("Saved"); await onSave(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Save failed"); } };
  const remove = async () => { const next = await api.removeAiKey(); setForm(next); setMessage("Key removed"); await onSave(); };
  const test = async () => { setMessage("Testing..."); try { await api.testAiConnection(form); setMessage("Connection OK"); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Test failed"); } };
  return <section className="content-panel ai-settings"><div className="toolbar"><div><span className="eyebrow">AI settings</span><h2>Resume generation provider</h2></div><div className="resume-actions"><button className="button ghost" onClick={test}>Test Connection</button><button className="button primary" onClick={save}>Save</button><button className="button ghost" onClick={remove}>Remove Key</button></div></div><div className="profile-grid"><label>Provider<select value={form.provider} onChange={event => setProvider(event.target.value as AiProvider)}>{providerOptions.map(provider => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label><label>Model<select value={form.model} onChange={event => setForm(current => ({ ...current, model: event.target.value, reasoning_effort: defaultEffort(event.target.value) }))}>{!models.some(model => model.value === form.model) && <option value={form.model}>{form.model} (unsupported; choose a listed model)</option>}{models.map(model => <option key={model.value} value={model.value}>{form.provider === "openai" ? priceLabel(modelInfo(model.value)!, modelInfo(model.value)!.efforts.includes(form.reasoning_effort!) ? form.reasoning_effort : defaultEffort(model.value), estimatedInput) : model.label}</option>)}</select></label>{form.provider === "openai" && <label>Reasoning<select value={form.reasoning_effort ?? defaultEffort(form.model)} onChange={event => setForm(current => ({ ...current, reasoning_effort: event.target.value as ReasoningEffort }))}>{modelInfo(form.model)?.efforts.map(effort => <option key={effort} value={effort}>{effort} (est. ${scenarioCost(modelInfo(form.model)!, effort, estimatedInput).toFixed(4)})</option>)}</select></label>}<label className="ai-key-field">API Key<input type="password" value={form.api_key} onChange={event => setForm(current => ({ ...current, api_key: event.target.value }))} autoComplete="off" /></label>{message && <p className="inline-error ai-settings-message">{message}</p>}</div></section>;
}

function ResumePage({ profile, settings, resumes, onProfileSave, onSettingsChanged, onDelete, onExport, onImport }: {
  profile: ResumeProfile;
  settings: AiSettings;
  resumes: GeneratedResume[];
  onProfileSave: (profile: ResumeProfileUpdate) => Promise<void>;
  onSettingsChanged: () => Promise<void>;
  onDelete: (resume: GeneratedResume) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
}) {
  const [form, setForm] = useState<ResumeProfileUpdate>(() => {
    const { id: _id, updated_at: _updated, ...values } = profile;
    return values as ResumeProfileUpdate;
  });
  const [savedAt, setSavedAt] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const { id: _id, updated_at: _updated, ...values } = profile;
    setForm(values as ResumeProfileUpdate);
  }, [profile.id, profile.updated_at]);
  useEffect(() => {
    const timer = window.setTimeout(async () => { await onProfileSave(form); setSavedAt(new Date().toLocaleTimeString()); }, 600);
    return () => window.clearTimeout(timer);
  }, [form]);
  return <div className="resume-page"><AiSettingsPanel settings={settings} profile={form} onSave={onSettingsChanged} />
    <section className="content-panel"><div className="toolbar"><div><span className="eyebrow">Base information {savedAt && `· Autosaved ${savedAt}`}</span><h2>Resume profile</h2><p className="helper-text">Your master profile. Changes save automatically.</p></div><div className="resume-actions"><button className="button ghost" onClick={onExport}><Download size={14} /> Export Everything</button><button className="button ghost" onClick={() => importRef.current?.click()}><Upload size={14} /> Import Backup</button><input ref={importRef} hidden type="file" accept=".zip" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); }} /></div></div>
      <ProfileEditor value={form} onChange={setForm} />
    </section><section className="content-panel"><div className="toolbar"><div><span className="eyebrow">{resumes.length} versions</span><h2>Generated resumes</h2></div></div>{resumes.length ? <div className="saved-resume-list">{resumes.map(resume => <article key={resume.id}><div><strong>{resume.resume_name}</strong><span>{resume.company_name} · {resume.job_title || "No job title"} · {new Date(resume.created_at).toLocaleString()}</span><details><summary>View structured JSON</summary><pre>{JSON.stringify(resume.structured_resume, null, 2)}</pre></details></div><div><button className="delete" onClick={() => onDelete(resume)}>Delete</button></div></article>)}</div> : <p className="empty-copy">No resume versions yet. Open Resume from a company to create an application and generate one.</p>}</section></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const overviewFilters = useOverviewFilters();
  const generationTasks = useSyncExternalStore(subscribeGeneration, getGenerationTasks);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  const [features, setFeatures] = useState<FeatureStatus | null>(null);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [resumeCompany, setResumeCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [companyData, analyticsData, profileData, resumeData, featureData, settingsData] = await Promise.all([api.companies(), api.analytics(), api.profile(), api.resumes(), api.features(), api.aiSettings()]);
      setCompanies(companyData); setAnalytics(analyticsData); setProfile(profileData); setResumes(resumeData); setFeatures(featureData); setSettings(settingsData); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load InternRadar"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const updateCompany = async (company: Company, data: CompanyUpdate) => {
    const updated = await api.updateCompany(company.id, data);
    setCompanies(current => current.map(item => item.id === updated.id ? updated : item));
    setAnalytics(await api.analytics());
  };
  const quickApply = async (company: Company) => {
    if (company.application_count) { setResumeCompany(company); return; }
    await api.createApplication({ company_id: company.id, job_title: "", job_description: "", notes: "" });
    await load();
  };
  if (loading) return <div className="app-state"><Radar className="spin" size={34} /><strong>Loading InternRadar...</strong></div>;
  if (error || !analytics || !profile || !settings) return <div className="app-state"><Radar size={34} /><strong>Unable to load local data</strong><p>{error}</p><button className="button primary" onClick={load}>Try again</button></div>;

  const nav = [["overview", LayoutDashboard, "Overview"], ["analytics", BarChart3, "Analytics"], ["resume", FileText, "Resume"]] as const;
  return <div className="shell"><aside><div className="brand"><span><Radar size={23} /></span><div><strong>InternRadar</strong><small>Browser-local tracker</small></div></div><nav>{nav.map(([id, Icon, label]) => <button className={page === id ? "active" : ""} key={id} onClick={() => setPage(id)}><Icon size={19} /><span>{label}</span></button>)}</nav></aside><main><header><div><span className="eyebrow">GitHub Pages ready · browser-local data</span><h1>{page === "overview" ? "Company applications" : page === "analytics" ? "Application analytics" : "Resume studio"}</h1><p>{page === "overview" ? "Track companies, applications, notes, links, and resume versions." : page === "analytics" ? "A simple view of your application pipeline." : "Maintain your master profile, AI settings, backups, and generated resumes."}</p></div></header><div aria-live="polite" className="generation-status-list">{generationTasks.map(task => <div className="compiler-note" key={task.companyId}><button className="button ghost compact-button" onClick={() => { const company = companies.find(item => item.id === task.companyId); if (company) setResumeCompany(company); }}>{task.companyName}: {task.status === "running" ? "Generating resume..." : task.status === "completed" ? "Resume ready" : "Generation failed"}</button>{task.status !== "running" && <button className="button ghost compact-button" aria-label={`Dismiss generation status for ${task.companyName}`} onClick={() => dismissGeneration(task.companyId)}>Dismiss</button>}</div>)}</div>{page === "overview" && <Overview filters={overviewFilters} companies={companies} onUpdate={updateCompany} onEdit={setEditing} onResume={setResumeCompany} onQuickApply={quickApply} />}{page === "analytics" && <AnalyticsPage analytics={analytics} />}{page === "resume" && <ResumePage profile={profile} settings={settings} resumes={resumes} onProfileSave={async data => setProfile(await api.updateProfile(data))} onSettingsChanged={load} onDelete={async resume => { if (confirm(`Delete ${resume.resume_name}?`)) { await api.deleteResume(resume.id); await load(); } }} onExport={async () => downloadBlob(await api.exportBackup(), `InternRadar-backup-${new Date().toISOString().slice(0, 10)}.zip`)} onImport={async file => { await api.importBackup(file); await load(); }} />}</main>{editing && <CompanyModal company={editing} onClose={() => setEditing(null)} onSave={data => updateCompany(editing, data)} />}{resumeCompany && <ResumeModal company={resumeCompany} features={features} onClose={() => setResumeCompany(null)} onSaved={load} />}</div>;
}
