import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, Download, ExternalLink, FileText, Grid2X2, LayoutDashboard,
  List, MapPin, Radar, Search, Upload,
} from "lucide-react";
import { api } from "./api/client";
import { CompanyModal } from "./components/CompanyModal";
import { Logo } from "./components/Logo";
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
    models: [
      { value: "gpt-5.6-sol", label: "GPT-5.6 Sol (Max)" },
      { value: "gpt-5.6-terra", label: "GPT-5.6 Terra (Max)" },
      { value: "gpt-5.6-luna", label: "GPT-5.6 Luna (Max)" },
    ],
  },
  { value: "gemini", label: "Gemini", models: [{ value: "gemini-3.8-flash", label: "Gemini 3.8 Flash" }] },
  { value: "glm", label: "GLM", models: [{ value: "glm-5.3-flash", label: "GLM-5.3-Flash" }] },
];

function InternBadge() {
  return <span className="intern-badge" title="Recurring internship or co-op hiring">Intern</span>;
}

function Overview({ companies, onUpdate, onEdit, onResume, onQuickApply }: {
  companies: Company[];
  onUpdate: (company: Company, data: CompanyUpdate) => Promise<void>;
  onEdit: (company: Company) => void;
  onResume: (company: Company) => void;
  onQuickApply: (company: Company) => Promise<void>;
}) {
  const [view, setView] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [category, setCategory] = useState("");
  const [internHiring, setInternHiring] = useState("");
  const [sort, setSort] = useState<"tier" | "company">("tier");
  const [descending, setDescending] = useState(false);
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

function AiSettingsPanel({ settings, onSave }: { settings: AiSettings; onSave: () => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState("");
  useEffect(() => setForm(settings), [settings.updated_at]);
  const models = providerOptions.find(option => option.value === form.provider)?.models || providerOptions[0].models;
  const setProvider = (provider: AiProvider) => {
    const model = providerOptions.find(option => option.value === provider)?.models[0].value || "gpt-5.6-sol";
    setForm(current => ({ ...current, provider, model }));
    setMessage("");
  };
  const save = async () => { await api.saveAiSettings(form); setMessage("Saved"); await onSave(); };
  const remove = async () => { const next = await api.removeAiKey(); setForm(next); setMessage("Key removed"); await onSave(); };
  const test = async () => { setMessage("Testing..."); try { await api.testAiConnection(form); setMessage("Connection OK"); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Test failed"); } };
  return <section className="content-panel ai-settings"><div className="toolbar"><div><span className="eyebrow">AI settings</span><h2>Resume generation provider</h2></div><div className="resume-actions"><button className="button ghost" onClick={test}>Test Connection</button><button className="button primary" onClick={save}>Save</button><button className="button ghost" onClick={remove}>Remove Key</button></div></div><div className="profile-grid"><label>Provider<select value={form.provider} onChange={event => setProvider(event.target.value as AiProvider)}>{providerOptions.map(provider => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label><label>Model<select value={form.model} onChange={event => setForm(current => ({ ...current, model: event.target.value }))}>{models.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}</select></label><label className="profile-section">API Key<input type="password" value={form.api_key} onChange={event => setForm(current => ({ ...current, api_key: event.target.value }))} autoComplete="off" /></label>{message && <p className="inline-error profile-section">{message}</p>}</div></section>;
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
  const updateField = <K extends keyof ResumeProfileUpdate>(key: K, value: ResumeProfileUpdate[K]) => setForm(c => ({ ...c, [key]: value }));
  const updateNested = (updater: (d: ResumeProfileUpdate) => void) => setForm(c => { const n = structuredClone(c) as ResumeProfileUpdate; updater(n); return n; });
  return <div className="resume-page"><AiSettingsPanel settings={settings} onSave={onSettingsChanged} />
    <section className="content-panel"><div className="toolbar"><div><span className="eyebrow">Base information {savedAt && `· Autosaved ${savedAt}`}</span><h2>Resume profile</h2><p className="helper-text">Structured fields – dates from Profile, not AI.</p></div><div className="resume-actions"><button className="button ghost" onClick={onExport}><Download size={14} /> Export Everything</button><button className="button ghost" onClick={() => importRef.current?.click()}><Upload size={14} /> Import Backup</button><input ref={importRef} hidden type="file" accept=".zip" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); }} /></div></div>
      <div className="profile-grid">
        <label>First Name<input value={form.firstName} onChange={e => updateField("firstName", e.target.value)} /></label>
        <label>Last Name<input value={form.lastName} onChange={e => updateField("lastName", e.target.value)} /></label>
        <label>Email<input value={form.email} onChange={e => updateField("email", e.target.value)} /></label>
        <label>Phone<input value={form.phone} onChange={e => updateField("phone", e.target.value)} /></label>
        <label>Location / relocation<input value={form.location} onChange={e => updateField("location", e.target.value)} /></label>
        <label>LinkedIn<input value={form.linkedin} onChange={e => updateField("linkedin", e.target.value)} /></label>
        <label>GitHub<input value={form.github} onChange={e => updateField("github", e.target.value)} /></label>
        <label>Website<input value={form.website} onChange={e => updateField("website", e.target.value)} /></label>
      </div>
      <div className="profile-section"><h3>Education</h3>{form.education.map((edu, idx) => <div key={idx} className="profile-subgrid"><label>Institution<input value={edu.institution} onChange={e => updateNested(d => { d.education[idx].institution = e.target.value; })} /></label><label>Degree<input value={edu.degree} onChange={e => updateNested(d => { d.education[idx].degree = e.target.value; })} /></label><label>Location<input value={edu.location} onChange={e => updateNested(d => { d.education[idx].location = e.target.value; })} /></label><label>Start<input value={edu.startDate} onChange={e => updateNested(d => { d.education[idx].startDate = e.target.value; })} placeholder="Sep. 2024" /></label><label>End / Expected<input value={edu.endDate} onChange={e => updateNested(d => { d.education[idx].endDate = e.target.value; })} placeholder="Expected May 2029" /></label><button className="button ghost" onClick={() => updateNested(d => { d.education.splice(idx, 1); })}>Remove</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.education.push({ institution: "", degree: "", location: "", startDate: "", endDate: "" }); })}>+ Add education</button></div>
      <div className="profile-section"><h3>Work Experience</h3>{form.workExperiences.map((exp, idx) => <div key={idx} className="profile-card"><label>Company<input value={exp.company} onChange={e => updateNested(d => { d.workExperiences[idx].company = e.target.value; })} /></label><label>Actual job title<input value={exp.title} onChange={e => updateNested(d => { d.workExperiences[idx].title = e.target.value; })} /></label><label>Location<input value={exp.location} onChange={e => updateNested(d => { d.workExperiences[idx].location = e.target.value; })} /></label><label>Start<input value={exp.startDate} onChange={e => updateNested(d => { d.workExperiences[idx].startDate = e.target.value; })} /></label><label>End<input value={exp.endDate} onChange={e => updateNested(d => { d.workExperiences[idx].endDate = e.target.value; })} disabled={exp.isCurrent} /></label><label><input type="checkbox" checked={exp.isCurrent} onChange={e => updateNested(d => { d.workExperiences[idx].isCurrent = e.target.checked; if (e.target.checked) d.workExperiences[idx].endDate = "Present"; })} /> Current</label>{exp.subprojects.map((sub, sIdx) => <div key={sIdx} className="profile-subproject"><label>Subproject<input value={sub.name} onChange={e => updateNested(d => { d.workExperiences[idx].subprojects[sIdx].name = e.target.value; })} /></label>{sub.bullets.map((b, bIdx) => <div key={bIdx} className="profile-bullet"><label>Bullet<textarea rows={2} value={b.text} onChange={e => updateNested(d => { d.workExperiences[idx].subprojects[sIdx].bullets[bIdx].text = e.target.value; })} /></label><label>Highlights (comma, 0-2)<input value={b.highlights.join(", ")} onChange={e => updateNested(d => { d.workExperiences[idx].subprojects[sIdx].bullets[bIdx].highlights = e.target.value.split(",").map(s => s.trim()).filter(Boolean).slice(0,2); })} /></label><button className="button ghost" onClick={() => updateNested(d => { d.workExperiences[idx].subprojects[sIdx].bullets.splice(bIdx,1); })}>Remove bullet</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.workExperiences[idx].subprojects[sIdx].bullets.push({ text: "", highlights: [] }); })}>+ Bullet</button><button className="button ghost" onClick={() => updateNested(d => { d.workExperiences[idx].subprojects.splice(sIdx,1); })}>Remove subproject</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.workExperiences[idx].subprojects.push({ name: "", bullets: [{ text: "", highlights: [] }] }); })}>+ Subproject</button><button className="button ghost" onClick={() => updateNested(d => { d.workExperiences.splice(idx,1); })}>Remove work</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.workExperiences.push({ company: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, subprojects: [{ name: "", bullets: [{ text: "", highlights: [] }] }] }); })}>+ Add work</button></div>
      <div className="profile-section"><h3>Research Experience</h3>{form.researchExperiences.map((exp, idx) => <div key={idx} className="profile-card"><label>Organization<input value={exp.organization} onChange={e => updateNested(d => { d.researchExperiences[idx].organization = e.target.value; })} /></label><label>Research title<input value={exp.title} onChange={e => updateNested(d => { d.researchExperiences[idx].title = e.target.value; })} /></label><label>Location<input value={exp.location} onChange={e => updateNested(d => { d.researchExperiences[idx].location = e.target.value; })} /></label><label>Start<input value={exp.startDate} onChange={e => updateNested(d => { d.researchExperiences[idx].startDate = e.target.value; })} /></label><label>End<input value={exp.endDate} onChange={e => updateNested(d => { d.researchExperiences[idx].endDate = e.target.value; })} disabled={exp.isCurrent} /></label><label><input type="checkbox" checked={exp.isCurrent} onChange={e => updateNested(d => { d.researchExperiences[idx].isCurrent = e.target.checked; if (e.target.checked) d.researchExperiences[idx].endDate = "Present"; })} /> Current</label>{exp.subprojects.map((sub, sIdx) => <div key={sIdx} className="profile-subproject"><label>Project<input value={sub.name} onChange={e => updateNested(d => { d.researchExperiences[idx].subprojects[sIdx].name = e.target.value; })} /></label>{sub.bullets.map((b, bIdx) => <div key={bIdx} className="profile-bullet"><label>Bullet<textarea rows={2} value={b.text} onChange={e => updateNested(d => { d.researchExperiences[idx].subprojects[sIdx].bullets[bIdx].text = e.target.value; })} /></label><label>Highlights<input value={b.highlights.join(", ")} onChange={e => updateNested(d => { d.researchExperiences[idx].subprojects[sIdx].bullets[bIdx].highlights = e.target.value.split(",").map(s=>s.trim()).filter(Boolean).slice(0,2); })} /></label><button className="button ghost" onClick={() => updateNested(d => { d.researchExperiences[idx].subprojects[sIdx].bullets.splice(bIdx,1); })}>Remove bullet</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.researchExperiences[idx].subprojects[sIdx].bullets.push({ text: "", highlights: [] }); })}>+ Bullet</button><button className="button ghost" onClick={() => updateNested(d => { d.researchExperiences[idx].subprojects.splice(sIdx,1); })}>Remove subproject</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.researchExperiences[idx].subprojects.push({ name: "", bullets: [{ text: "", highlights: [] }] }); })}>+ Subproject</button><button className="button ghost" onClick={() => updateNested(d => { d.researchExperiences.splice(idx,1); })}>Remove research</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.researchExperiences.push({ organization: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, subprojects: [{ name: "", bullets: [{ text: "", highlights: [] }] }] }); })}>+ Add research</button></div>
      <div className="profile-section"><h3>Standalone Projects (optional)</h3>{form.projects.map((proj, idx) => <div key={idx} className="profile-card"><label>Name<input value={proj.name} onChange={e => updateNested(d => { d.projects[idx].name = e.target.value; })} /></label><label>Technologies (comma)<input value={proj.technologies.join(", ")} onChange={e => updateNested(d => { d.projects[idx].technologies = e.target.value.split(",").map(s=>s.trim()).filter(Boolean); })} /></label><label>Dates<input value={proj.dates} onChange={e => updateNested(d => { d.projects[idx].dates = e.target.value; })} /></label>{proj.bullets.map((b, bIdx) => <div key={bIdx} className="profile-bullet"><label>Bullet<textarea rows={2} value={b.text} onChange={e => updateNested(d => { d.projects[idx].bullets[bIdx].text = e.target.value; })} /></label><label>Highlights<input value={b.highlights.join(", ")} onChange={e => updateNested(d => { d.projects[idx].bullets[bIdx].highlights = e.target.value.split(",").map(s=>s.trim()).filter(Boolean).slice(0,2); })} /></label><button className="button ghost" onClick={() => updateNested(d => { d.projects[idx].bullets.splice(bIdx,1); })}>Remove</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.projects[idx].bullets.push({ text: "", highlights: [] }); })}>+ Bullet</button><button className="button ghost" onClick={() => updateNested(d => { d.projects.splice(idx,1); })}>Remove project</button></div>)}<button className="button ghost" onClick={() => updateNested(d => { d.projects.push({ name: "", technologies: [], dates: "", bullets: [{ text: "", highlights: [] }] }); })}>+ Add project</button></div>
      <div className="profile-section"><h3>Technical Skills</h3>{(["languages","frameworks","developerTools","libraries"] as const).map(group => <label key={group}>{group}<input value={(form.skills as unknown as Record<string,string[]>)[group].join(", ")} onChange={e => updateNested(d => { (d.skills as unknown as Record<string,string[]>)[group] = e.target.value.split(",").map(s=>s.trim()).filter(Boolean); })} /></label>)}</div>
    </section><section className="content-panel"><div className="toolbar"><div><span className="eyebrow">{resumes.length} versions</span><h2>Generated resumes</h2></div></div>{resumes.length ? <div className="saved-resume-list">{resumes.map(resume => <article key={resume.id}><div><strong>{resume.resume_name}</strong><span>{resume.company_name} · {resume.job_title || "No job title"} · {new Date(resume.created_at).toLocaleString()}</span><details><summary>View structured JSON</summary><pre>{JSON.stringify(resume.structured_resume, null, 2)}</pre></details></div><div><button className="delete" onClick={() => onDelete(resume)}>Delete</button></div></article>)}</div> : <p className="empty-copy">No resume versions yet. Open Resume from a company to create an application and generate one.</p>}</section></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("overview");
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
  return <div className="shell"><aside><div className="brand"><span><Radar size={23} /></span><div><strong>InternRadar</strong><small>Browser-local tracker</small></div></div><nav>{nav.map(([id, Icon, label]) => <button className={page === id ? "active" : ""} key={id} onClick={() => setPage(id)}><Icon size={19} /><span>{label}</span></button>)}</nav></aside><main><header><div><span className="eyebrow">GitHub Pages ready · browser-local data</span><h1>{page === "overview" ? "Company applications" : page === "analytics" ? "Application analytics" : "Resume studio"}</h1><p>{page === "overview" ? "Track companies, applications, notes, links, and resume versions." : page === "analytics" ? "A simple view of your application pipeline." : "Maintain your master profile, AI settings, backups, and generated resumes."}</p></div></header>{page === "overview" && <Overview companies={companies} onUpdate={updateCompany} onEdit={setEditing} onResume={setResumeCompany} onQuickApply={quickApply} />}{page === "analytics" && <AnalyticsPage analytics={analytics} />}{page === "resume" && <ResumePage profile={profile} settings={settings} resumes={resumes} onProfileSave={async data => setProfile(await api.updateProfile(data))} onSettingsChanged={load} onDelete={async resume => { if (confirm(`Delete ${resume.resume_name}?`)) { await api.deleteResume(resume.id); await load(); } }} onExport={async () => downloadBlob(await api.exportBackup(), `InternRadar-backup-${new Date().toISOString().slice(0, 10)}.zip`)} onImport={async file => { await api.importBackup(file); await load(); }} />}</main>{editing && <CompanyModal company={editing} onClose={() => setEditing(null)} onSave={data => updateCompany(editing, data)} />}{resumeCompany && <ResumeModal company={resumeCompany} features={features} onClose={() => setResumeCompany(null)} onSaved={load} />}</div>;
}
