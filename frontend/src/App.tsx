import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Building2, Copy, Download, ExternalLink, FileText,
  Grid2X2, LayoutDashboard, List, MapPin, Radar, Search, Trash2,
} from "lucide-react";
import { api } from "./api/client";
import { CompanyModal } from "./components/CompanyModal";
import { Logo } from "./components/Logo";
import { downloadTex, ResumeModal } from "./components/ResumeModal";
import type {
  Analytics, Company, CompanyStatus, CompanyUpdate, FeatureStatus,
  GeneratedResume, ResumeProfile, ResumeProfileUpdate,
} from "./types";

type Page = "overview" | "analytics" | "resume";
const statuses: CompanyStatus[] = ["Not Applied", "Applied"];
const tierOrder = ["S+", "S", "A+", "A", "B+", "B", "C", "D"];

function Overview({ companies, onUpdate, onEdit, onResume }: {
  companies: Company[];
  onUpdate: (company: Company, data: CompanyUpdate) => Promise<void>;
  onEdit: (company: Company) => void;
  onResume: (company: Company) => void;
}) {
  const [view, setView] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"tier" | "company">("tier");
  const [descending, setDescending] = useState(false);
  const tiers = useMemo(() => tierOrder.filter(value => companies.some(company => company.tier === value)), [companies]);
  const categories = useMemo(() => [...new Set(companies.map(company => company.category))].sort(), [companies]);
  const filtered = companies.filter(company =>
    (!search || `${company.name} ${company.category} ${company.main_locations}`.toLowerCase().includes(search.toLowerCase())) &&
    (!status || company.status === status) && (!tier || company.tier === tier) &&
    (!category || company.category === category)
  );
  const sorted = [...filtered].sort((left, right) => {
    const tierRank = (value: string) => {
      const rank = tierOrder.indexOf(value);
      return rank === -1 ? tierOrder.length : rank;
    };
    const result = sort === "company"
      ? left.name.localeCompare(right.name)
      : (tierRank(left.tier) - tierRank(right.tier)) || left.name.localeCompare(right.name);
    return descending ? -result : result;
  });
  const changeSort = (next: "tier" | "company") => {
    if (sort === next) setDescending(value => !value);
    else { setSort(next); setDescending(false); }
  };
  return <section className="content-panel">
    <div className="toolbar"><div><span className="eyebrow">{sorted.length} companies</span><h2>Company tracker</h2></div><div className="view-toggle"><button className={view === "table" ? "active" : ""} onClick={() => setView("table")}><List size={17} /> Table</button><button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}><Grid2X2 size={17} /> Cards</button></div></div>
    <div className="filters simple-filters"><label className="search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search companies, categories, locations..." /></label><select value={tier} onChange={event => setTier(event.target.value)}><option value="">All tiers</option>{tiers.map(value => <option key={value}>{value}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></div>
    {view === "table" ? <div className="table-wrap overview-table"><table><colgroup><col className="col-tier" /><col className="col-company" /><col className="col-location" /><col className="col-status" /><col className="col-link" /><col className="col-resume" /><col className="col-notes" /></colgroup><thead><tr><th><button className={sort === "tier" ? "active" : ""} onClick={() => changeSort("tier")}>Tier {sort === "tier" ? (descending ? "↓" : "↑") : ""}</button></th><th><button className={sort === "company" ? "active" : ""} onClick={() => changeSort("company")}>Company {sort === "company" ? (descending ? "↓" : "↑") : ""}</button></th><th>Location</th><th>Status</th><th>Link</th><th>Resume</th><th>Notes</th></tr></thead><tbody>{sorted.map(company => <tr key={company.id} onDoubleClick={() => onEdit(company)}><td><span className={`tier tier-${company.tier}`}>{company.tier}</span></td><td><div className="company-cell"><Logo name={company.name} domain={company.domain} url={company.logo_url} /><div><strong>{company.name}</strong><span>{company.category}</span></div></div></td><td><span className="location-cell"><MapPin size={14} />{company.main_locations || "Not listed"}</span></td><td><label className="applied-toggle"><input type="checkbox" checked={company.status === "Applied"} onChange={event => onUpdate(company, { status: event.target.checked ? "Applied" : "Not Applied" })} /><span>{company.status}</span></label></td><td>{company.link ? <a className="button ghost compact-button" href={company.link} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a> : <button className="button ghost compact-button" onClick={() => onEdit(company)}>Add link</button>}</td><td><button className="button primary compact-button" onClick={() => onResume(company)}>Resume{company.resume_count ? ` (${company.resume_count})` : ""}</button></td><td><button className="table-note edit-note" title={company.notes} onClick={() => onEdit(company)}>{company.notes || "Add notes"}</button></td></tr>)}</tbody></table></div>
      : <div className="company-grid">{sorted.map(company => <article className="company-card simple-card" key={company.id}><div className="card-top"><Logo name={company.name} domain={company.domain} url={company.logo_url} size={48} /><span className={`tier tier-${company.tier}`}>{company.tier}</span></div><div className="card-title"><div><h3>{company.name}</h3><span>{company.category}</span></div></div><div className="card-facts"><div><span>Location</span><strong>{company.main_locations || "Not listed"}</strong></div></div><label className="applied-toggle card-applied"><input type="checkbox" checked={company.status === "Applied"} onChange={event => onUpdate(company, { status: event.target.checked ? "Applied" : "Not Applied" })} /><span>{company.status}</span></label><button className="notes-preview edit-note" onClick={() => onEdit(company)}>{company.notes || "Add notes for this company."}</button><div className="card-actions"><button className="button ghost" onClick={() => onEdit(company)}>Edit</button>{company.link ? <a className="button ghost" href={company.link} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a> : <button className="button ghost" onClick={() => onEdit(company)}>Add link</button>}<button className="button primary" onClick={() => onResume(company)}>Resume{company.resume_count ? ` (${company.resume_count})` : ""}</button></div></article>)}</div>}
  </section>;
}

function AnalyticsPage({ analytics }: { analytics: Analytics }) {
  const cards = [
    ["Total companies", analytics.total_companies], ["Applied", analytics.applied_count],
    ["Not applied", analytics.status_counts["Not Applied"] || 0],
    ["Saved resumes", analytics.saved_resume_count],
    ["Companies with resumes", analytics.companies_with_resumes],
  ];
  return <><div className="summary-grid personal-summary">{cards.map(([label, value]) => <div className="summary-card" key={label}><div><span>{label}</span><strong>{value}</strong></div></div>)}</div><div className="analytics-layout"><section className="panel"><div className="panel-head"><h2>Application status</h2></div><div className="funnel">{statuses.map(value => <div key={value}><span>{value}</span><div><i style={{ width: `${Math.max(2, (analytics.status_counts[value] || 0) / Math.max(1, analytics.total_companies) * 100)}%` }} /></div><strong>{analytics.status_counts[value] || 0}</strong></div>)}</div></section><section className="panel"><div className="panel-head"><h2>Companies by tier</h2></div><div className="tier-stats">{Object.entries(analytics.tier_counts).map(([tier, count]) => <div key={tier}><span className={`tier tier-${tier}`}>{tier}</span><strong>{count}</strong><small>companies</small></div>)}</div></section><section className="panel"><div className="panel-head"><h2>Recent saved resumes</h2></div><div className="recent-list">{analytics.recent_resumes.length ? analytics.recent_resumes.map(item => <div key={item.id}><strong>{item.resume_name}</strong><span>{item.company_name} · {new Date(item.created_at).toLocaleDateString()}</span></div>) : <p>No saved resumes yet.</p>}</div></section></div></>;
}

function ResumePage({ profile, resumes, onProfileSave, onDelete }: {
  profile: ResumeProfile;
  resumes: GeneratedResume[];
  onProfileSave: (profile: ResumeProfileUpdate) => Promise<void>;
  onDelete: (resume: GeneratedResume) => Promise<void>;
}) {
  const [form, setForm] = useState<ResumeProfileUpdate>(() => {
    const { id: _id, updated_at: _updated, ...values } = profile;
    return values;
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ResumeProfileUpdate, value: string) => setForm(current => ({ ...current, [key]: value }));
  return <div className="resume-page"><section className="content-panel"><div className="toolbar"><div><span className="eyebrow">Base information</span><h2>Resume profile</h2><p className="helper-text">DeepSeek may only use truthful information stored here.</p></div><button className="button primary" disabled={saving} onClick={async () => { setSaving(true); try { await onProfileSave(form); } finally { setSaving(false); } }}>{saving ? "Saving..." : "Save profile"}</button></div><div className="template-guidance"><strong>Generation format</strong><span>Complete Overleaf-compatible LaTeX, ATS-friendly, concise, one page where possible, and never fabricated.</span></div><div className="profile-grid">{(["name", "email", "phone", "location", "linkedin", "github", "website"] as const).map(key => <label key={key}>{key.replace("_", " ")}<input value={form[key]} onChange={event => set(key, event.target.value)} /></label>)}{(["education_text", "experience_text", "projects_text", "skills_text", "awards_text", "other_text"] as const).map(key => <label className="profile-section" key={key}>{key.replace("_text", "").replace("_", " ")}<textarea rows={key === "experience_text" ? 10 : 6} value={form[key]} onChange={event => set(key, event.target.value)} placeholder="Paste plain text or markdown..." /></label>)}</div></section><section className="content-panel"><div className="toolbar"><div><span className="eyebrow">{resumes.length} saved</span><h2>Generated resumes</h2></div></div>{resumes.length ? <div className="saved-resume-list">{resumes.map(resume => <article key={resume.id}><div><strong>{resume.resume_name}</strong><span>{resume.company_name} · {resume.job_title || "No job title"} · {new Date(resume.created_at).toLocaleDateString()}</span><details><summary>View JD</summary><pre>{resume.jd_text}</pre></details><details><summary>View LaTeX</summary><pre>{resume.generated_latex}</pre></details></div><div><button onClick={() => navigator.clipboard.writeText(resume.generated_latex)}><Copy size={14} /> Copy LaTeX</button><button onClick={() => downloadTex(resume.resume_name, resume.generated_latex)}><Download size={14} /> .tex</button><button className="delete" onClick={() => onDelete(resume)}><Trash2 size={14} /> Delete</button></div></article>)}</div> : <p className="empty-copy">No saved resumes yet. Open Resume from a company to generate one.</p>}</section></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  const [features, setFeatures] = useState<FeatureStatus | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [resumeCompany, setResumeCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [companyData, analyticsData, profileData, resumeData, featureData] = await Promise.all([
        api.companies(), api.analytics(), api.profile(), api.resumes(), api.features(),
      ]);
      setCompanies(companyData); setAnalytics(analyticsData); setProfile(profileData);
      setResumes(resumeData); setFeatures(featureData); setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load InternRadar");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const updateCompany = async (company: Company, data: CompanyUpdate) => {
    const updated = await api.updateCompany(company.id, data);
    setCompanies(current => current.map(item => item.id === updated.id ? updated : item));
    setAnalytics(await api.analytics());
  };
  if (loading) return <div className="app-state"><Radar className="spin" size={34} /><strong>Loading InternRadar...</strong></div>;
  if (error || !analytics || !profile) return <div className="app-state"><Radar size={34} /><strong>Backend unavailable</strong><p>{error}</p><button className="button primary" onClick={load}>Try again</button></div>;

  const nav = [["overview", LayoutDashboard, "Overview"], ["analytics", BarChart3, "Analytics"], ["resume", FileText, "Resume"]] as const;
  return <div className="shell"><aside><div className="brand"><span><Radar size={23} /></span><div><strong>InternRadar</strong><small>Personal application tracker</small></div></div><nav>{nav.map(([id, Icon, label]) => <button className={page === id ? "active" : ""} key={id} onClick={() => setPage(id)}><Icon size={19} />{label}</button>)}</nav></aside><main><header><div><span className="eyebrow">Local personal workspace</span><h1>{page === "overview" ? "Company applications" : page === "analytics" ? "Application analytics" : "Resume studio"}</h1><p>{page === "overview" ? "Track company status, notes, links, and tailored resumes." : page === "analytics" ? "A simple view of your application pipeline." : "Maintain your truthful base profile and saved Overleaf resumes."}</p></div></header>{page === "overview" && <Overview companies={companies} onUpdate={updateCompany} onEdit={setEditing} onResume={setResumeCompany} />}{page === "analytics" && <AnalyticsPage analytics={analytics} />}{page === "resume" && <ResumePage profile={profile} resumes={resumes} onProfileSave={async data => setProfile(await api.updateProfile(data))} onDelete={async resume => { if (confirm(`Delete ${resume.resume_name}?`)) { await api.deleteResume(resume.id); await load(); } }} />}</main>{editing && <CompanyModal company={editing} onClose={() => setEditing(null)} onSave={data => updateCompany(editing, data)} />}{resumeCompany && <ResumeModal company={resumeCompany} features={features} onClose={() => setResumeCompany(null)} onSaved={load} />}</div>;
}
