import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3, BriefcaseBusiness, Building2, ChevronRight, ExternalLink,
  Grid2X2, LayoutDashboard, List, MapPin, Plus, Radar, RotateCcw,
  Search, SlidersHorizontal, Sparkles, Target, Trophy, UsersRound,
} from "lucide-react";
import { api } from "./api/client";
import { CompanyModal } from "./components/CompanyModal";
import { JobModal } from "./components/JobModal";
import { Logo } from "./components/Logo";
import type { ApplicationStatus, Company, CompanyUpdate, Job, JobCreate, Summary } from "./types";

type Page = "dashboard" | "companies" | "jobs" | "analytics";
type SortKey = "match" | "jobs" | "name" | "tier" | "status" | "pay";
const statuses: ApplicationStatus[] = ["Not Applied", "Watching", "Interested", "Applied", "OA", "Interview", "Rejected", "Offer", "Hidden"];
const statusOrder = Object.fromEntries(statuses.map((s, i) => [s, i]));
const tiers = ["S+", "S", "A+", "A", "B+", "B", "C+", "C", "D+", "D"] as const;
const tierOrder = Object.fromEntries(tiers.map((tier, index) => [tier, index])) as Record<string, number>;

const money = (min: number | null, max: number | null, currency: string, period: string) => {
  if (min == null && max == null) return "Unknown";
  const amount = min === max || max == null ? `${min}` : `${min ?? "?"}-${max}`;
  const suffixes: Record<string, string> = { hourly: "/hr", monthly: "/mo", yearly: "/yr", unknown: "" };
  const suffix = suffixes[period] || "";
  return `${currency} ${amount}${suffix}`;
};
const relativeDate = (value: string) => {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status.toLowerCase().replace(/\s/g, "-")}`}>{status}</span>;
}

function Match({ value, compact = false }: { value: number; compact?: boolean }) {
  return <div className={`match ${compact ? "compact" : ""}`}><div className="match-head"><span>{value}%</span>{!compact && <span>match</span>}</div><div className="match-track"><i style={{ width: `${value}%` }} /></div></div>;
}

function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty"><div className="empty-icon"><Radar size={25} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    [Building2, "Companies", summary.total_companies, "in your radar"],
    [Radar, "Hiring now", summary.companies_hiring, "with open internships"],
    [BriefcaseBusiness, "Open roles", summary.total_open_roles, "active internships"],
    [Target, "Applications", summary.applied_count, "submitted"],
    [UsersRound, "Interviews", summary.interview_count, "in progress"],
    [Trophy, "Offers", summary.offer_count, "secured"],
    [Sparkles, "Avg. match", `${summary.average_match_score}%`, "across all companies"],
  ] as const;
  return <div className="summary-grid">{cards.map(([Icon, label, value, detail]) => <div className="summary-card" key={label}><div className="summary-icon"><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>)}</div>;
}

function Filters({ search, setSearch, tier, setTier, category, setCategory, status, setStatus, region, setRegion, openOnly, setOpenOnly, categories }: {
  search: string; setSearch: (v: string) => void; tier: string; setTier: (v: string) => void;
  category: string; setCategory: (v: string) => void; status: string; setStatus: (v: string) => void;
  region: string; setRegion: (v: string) => void; openOnly: boolean; setOpenOnly: (v: boolean) => void; categories: string[];
}) {
  return <div className="filters">
    <label className="search"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies, tags, locations..." /></label>
    <select aria-label="Tier" value={tier} onChange={e => setTier(e.target.value)}><option value="">All tiers</option>{tiers.map(v => <option key={v}>{v} tier</option>)}</select>
    <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(v => <option key={v}>{v}</option>)}</select>
    <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(v => <option key={v}>{v}</option>)}</select>
    <select aria-label="Region" value={region} onChange={e => setRegion(e.target.value)}><option value="">All regions</option>{["Canada", "US", "Remote", "Global"].map(v => <option key={v}>{v}</option>)}</select>
    <label className="filter-check"><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} /> Open only</label>
  </div>;
}

function CompanyTable({ companies, sort, setSort, onEdit, onStatus }: {
  companies: Company[]; sort: SortKey; setSort: (v: SortKey) => void;
  onEdit: (c: Company) => void; onStatus: (c: Company, s: ApplicationStatus) => void;
}) {
  const header = (label: string, key: SortKey) => <button className={sort === key ? "active" : ""} onClick={() => setSort(key)}>{label}</button>;
  return <div className="table-wrap"><table><thead><tr><th>Company</th><th>{header("Tier", "tier")}</th><th>{header("Open", "jobs")}</th><th>{header("Intern pay", "pay")}</th><th>Locations</th><th>{header("Status", "status")}</th><th>{header("Match", "match")}</th><th>Updated</th><th>Notes</th><th>Actions</th></tr></thead>
    <tbody>{companies.map(company => <tr key={company.id} onDoubleClick={() => onEdit(company)}>
      <td><div className="company-cell"><Logo name={company.name} domain={company.domain} url={company.logo_url} /><div><strong>{company.name}</strong><span>{company.category}</span></div></div></td>
      <td><span className={`tier tier-${company.tier}`}>{company.tier}</span></td>
      <td><span className={company.intern_open_count ? "open-count active" : "open-count"}>{company.intern_open_count}</span></td>
      <td className="nowrap">{money(company.average_intern_pay_min, company.average_intern_pay_max, company.pay_currency, company.pay_period)}</td>
      <td><span className="location-cell"><MapPin size={14} />{company.main_locations || "Unknown"}</span></td>
      <td><select className="status-select" value={company.application_status} onChange={e => onStatus(company, e.target.value as ApplicationStatus)}>{statuses.map(s => <option key={s}>{s}</option>)}</select></td>
      <td><Match value={company.match_score} compact /></td>
      <td className="muted nowrap">{relativeDate(company.last_updated)}</td>
      <td><span className="table-note" title={company.notes}>{company.notes || "No notes"}</span></td>
      <td><div className="row-actions"><button onClick={() => onEdit(company)}>Edit</button><a href={company.career_url} target="_blank" rel="noreferrer">Careers <ExternalLink size={13} /></a></div></td>
    </tr>)}</tbody></table></div>;
}

function CompanyCards({ companies, onEdit, onStatus, onAddJob }: {
  companies: Company[]; onEdit: (c: Company) => void;
  onStatus: (c: Company, s: ApplicationStatus) => void; onAddJob: (id: number) => void;
}) {
  return <div className="company-grid">{companies.map(company => <article className="company-card" key={company.id}>
    <div className="card-top"><Logo name={company.name} domain={company.domain} url={company.logo_url} size={48} /><span className={`tier tier-${company.tier}`}>{company.tier}</span></div>
    <div className="card-title"><div><h3>{company.name}</h3><span>{company.category}</span></div><span className={company.intern_open_count ? "jobs-pill active" : "jobs-pill"}>{company.intern_open_count} open</span></div>
    <StatusBadge status={company.application_status} />
    <Match value={company.match_score} />
    <div className="card-facts"><div><span>Intern pay</span><strong>{money(company.average_intern_pay_min, company.average_intern_pay_max, company.pay_currency, company.pay_period)}</strong></div><div><span>Locations</span><strong>{company.main_locations || "Unknown"}</strong></div></div>
    <p className="notes-preview">{company.notes || "No notes yet. Add context for your next check-in."}</p>
    <select className="quick-status" value={company.application_status} onChange={e => onStatus(company, e.target.value as ApplicationStatus)}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
    <div className="card-actions"><button className="button ghost" onClick={() => onEdit(company)}>Edit</button><button className="button ghost" onClick={() => onAddJob(company.id)}>+ Job</button><a className="button primary" href={company.career_url} target="_blank" rel="noreferrer">Careers <ExternalLink size={14} /></a></div>
  </article>)}</div>;
}

function Analytics({ summary }: { summary: Summary }) {
  const max = Math.max(1, ...Object.values(summary.category_counts));
  return <div className="analytics-layout">
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">Pipeline</span><h2>Application funnel</h2></div></div><div className="funnel">{statuses.filter(s => s !== "Hidden").map((status, i) => <div key={status}><span>{status}</span><div><i style={{ width: `${Math.max(3, (summary.status_counts[status] / Math.max(1, summary.total_companies)) * 100)}%`, opacity: 1 - i * .06 }} /></div><strong>{summary.status_counts[status] || 0}</strong></div>)}</div></section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">Portfolio</span><h2>Companies by category</h2></div></div><div className="bar-list">{Object.entries(summary.category_counts).sort((a,b) => b[1]-a[1]).map(([label, value]) => <div key={label}><div><span>{label}</span><strong>{value}</strong></div><div className="bar"><i style={{ width: `${value/max*100}%` }} /></div></div>)}</div></section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">Focus</span><h2>Companies by tier</h2></div></div><div className="tier-stats">{tiers.map(t => <div key={t}><span className={`tier tier-${t}`}>{t}</span><strong>{summary.tier_counts[t] || 0}</strong><small>companies</small></div>)}</div></section>
    <section className="panel chart-placeholder"><div className="panel-head"><div><span className="eyebrow">Trend</span><h2>Open internships over time</h2></div></div><div className="placeholder-chart"><div className="chart-line" /><Radar size={26} /><strong>Ready for history</strong><span>Trend data will appear as openings are added.</span></div></section>
  </div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const [editing, setEditing] = useState<Company | null>(null);
  const [addingJob, setAddingJob] = useState<number | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [region, setRegion] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("match");
  const [jobSearch, setJobSearch] = useState("");
  const [jobType, setJobType] = useState("");
  const [jobStatus, setJobStatus] = useState("");

  const load = async () => {
    setError("");
    try {
      const [companyData, jobData, summaryData] = await Promise.all([api.companies(), api.jobs(), api.summary()]);
      setCompanies(companyData); setJobs(jobData); setSummary(summaryData);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load data"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => [...new Set(companies.map(c => c.category))].sort(), [companies]);
  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return companies.filter(c => c.application_status !== "Hidden" || status === "Hidden").filter(c =>
      (!needle || `${c.name} ${c.tags} ${c.main_locations}`.toLowerCase().includes(needle)) &&
      (!tier || c.tier === tier) && (!category || c.category === category) &&
      (!status || c.application_status === status) && (!region || c.main_locations.toLowerCase().includes(region.toLowerCase())) &&
      (!openOnly || c.intern_open_count > 0)
    ).sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "jobs") return b.intern_open_count - a.intern_open_count;
      if (sort === "tier") return tierOrder[a.tier] - tierOrder[b.tier];
      if (sort === "status") return statusOrder[a.application_status] - statusOrder[b.application_status];
      if (sort === "pay") return (b.average_intern_pay_max || 0) - (a.average_intern_pay_max || 0);
      return b.match_score - a.match_score;
    });
  }, [companies, search, tier, category, status, region, openOnly, sort]);
  const filteredJobs = useMemo(() => jobs.filter(j =>
    (!jobSearch || `${j.title} ${j.company_name} ${j.location}`.toLowerCase().includes(jobSearch.toLowerCase())) &&
    (!jobType || j.job_type === jobType) && (!jobStatus || j.status === jobStatus)
  ), [jobs, jobSearch, jobType, jobStatus]);

  const updateCompany = async (company: Company, data: CompanyUpdate) => {
    const updated = await api.updateCompany(company.id, data);
    setCompanies(current => current.map(c => c.id === updated.id ? updated : c));
    setSummary(await api.summary());
  };
  const saveJob = async (job: JobCreate) => { await api.createJob(job); await load(); };
  const nav = [
    ["dashboard", LayoutDashboard, "Overview"], ["companies", Building2, "Companies"],
    ["jobs", BriefcaseBusiness, "Jobs"], ["analytics", BarChart3, "Analytics"],
  ] as const;
  if (loading) return <div className="app-state"><Radar className="spin" size={35} /><strong>Scanning your radar...</strong></div>;
  if (error) return <div className="app-state"><Radar size={35} /><strong>Backend unavailable</strong><p>{error}</p><button className="button primary" onClick={load}>Try again</button></div>;
  if (!summary) return null;

  const companyContent = <><div className="toolbar">
    <div><span className="eyebrow">{filtered.length} companies in view</span><h2>{page === "dashboard" ? "Your company radar" : "Company database"}</h2></div>
    <div className="toolbar-actions"><select value={sort} onChange={e => setSort(e.target.value as SortKey)}><option value="match">Sort: Match score</option><option value="jobs">Sort: Open roles</option><option value="name">Sort: Name</option><option value="tier">Sort: Tier</option><option value="status">Sort: Status</option><option value="pay">Sort: Pay</option></select><div className="view-toggle"><button className={view === "table" ? "active" : ""} onClick={() => setView("table")}><List size={17} /> Table</button><button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}><Grid2X2 size={17} /> Cards</button></div></div>
  </div><Filters {...{search,setSearch,tier,setTier,category,setCategory,status,setStatus,region,setRegion,openOnly,setOpenOnly,categories}} />
  {!filtered.length ? <Empty title="Nothing on this frequency" text="Try loosening a filter or add a manual opening." /> : view === "table"
    ? <CompanyTable companies={filtered} sort={sort} setSort={setSort} onEdit={setEditing} onStatus={(c,s) => updateCompany(c,{application_status:s})} />
    : <CompanyCards companies={filtered} onEdit={setEditing} onStatus={(c,s) => updateCompany(c,{application_status:s})} onAddJob={id => setAddingJob(id)} />}</>;

  return <div className="shell">
    <aside><div className="brand"><span><Radar size={23} /></span><div><strong>InternRadar</strong><small>Opportunity intelligence</small></div></div><nav>{nav.map(([id, Icon, label]) => <button className={page === id ? "active" : ""} key={id} onClick={() => setPage(id)}><Icon size={19} />{label}<ChevronRight size={15} /></button>)}</nav><div className="sidebar-card"><Sparkles size={19} /><strong>{summary.average_match_score}% avg match</strong><span>Your target list is tuned and ready.</span></div><button className="reset-link" onClick={async () => { if (confirm("Reset all companies and delete manual jobs?")) { await api.reset(); await load(); } }}><RotateCcw size={15} /> Reset seed data</button></aside>
    <main><header><div><span className="eyebrow">Friday focus</span><h1>{page === "dashboard" ? "Good morning, ready to hunt?" : page === "companies" ? "Company manager" : page === "jobs" ? "Manual job tracker" : "Radar analytics"}</h1><p>{page === "dashboard" ? "Your internship search, organized around the signals that matter." : page === "companies" ? "Research, prioritize, and track every target in one place." : page === "jobs" ? "Keep manually discovered roles actionable and current." : "See the shape and momentum of your search."}</p></div><button className="button primary add-button" onClick={() => setAddingJob(null)}><Plus size={17} /> Add job</button></header>
      {page === "dashboard" && <><SummaryCards summary={summary} /><section className="priority-strip"><div><span className="eyebrow">Highest priority, not applied</span><div>{summary.priority_companies.map(c => <button key={c.id} onClick={() => setEditing(c)}><Logo name={c.name} domain={c.domain} url={c.logo_url} size={32} /><span><strong>{c.name}</strong><small>{c.match_score}% match</small></span></button>)}</div></div></section><section className="content-panel">{companyContent}</section></>}
      {page === "companies" && <section className="content-panel">{companyContent}</section>}
      {page === "jobs" && <section className="content-panel"><div className="toolbar"><div><span className="eyebrow">{filteredJobs.length} tracked roles</span><h2>Job pipeline</h2></div><button className="button primary" onClick={() => setAddingJob(null)}><Plus size={16} /> Add manual job</button></div><div className="filters jobs-filters"><label className="search"><Search size={18} /><input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search title, company, location..." /></label><select value={jobType} onChange={e => setJobType(e.target.value)}><option value="">All job types</option>{["Internship","Co-op","New Grad","Full-time","Other"].map(v => <option key={v}>{v}</option>)}</select><select value={jobStatus} onChange={e => setJobStatus(e.target.value)}><option value="">All statuses</option>{["Open","Applied","Interview","Closed","Archived"].map(v => <option key={v}>{v}</option>)}</select></div>{!filteredJobs.length ? <Empty title="No manual jobs yet" text="Add an internship or co-op and its company count will update automatically." action={<button className="button primary" onClick={() => setAddingJob(null)}><Plus size={16} /> Add your first job</button>} /> : <div className="job-list">{filteredJobs.map(job => <article key={job.id}><div className="job-main"><div className="job-logo"><BriefcaseBusiness size={20} /></div><div><span>{job.company_name} · {job.job_type}</span><h3>{job.title}</h3><p><MapPin size={14} /> {job.location || "Location unknown"} {job.deadline && ` · Deadline ${new Date(job.deadline).toLocaleDateString()}`}</p></div></div><div className="job-meta"><Match value={job.company_match_score} compact /><strong>{money(job.salary_min, job.salary_max, job.currency, job.pay_period)}</strong><StatusBadge status={job.status} /><label className="switch"><input type="checkbox" checked={job.is_active} onChange={async e => { await api.updateJob(job.id,{is_active:e.target.checked}); await load(); }} /><span /></label>{job.apply_url && <a className="icon-button" href={job.apply_url} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>}<button className="delete" onClick={async () => { if(confirm("Delete this job?")) { await api.deleteJob(job.id); await load(); } }}>Delete</button></div></article>)}</div>}</section>}
      {page === "analytics" && <Analytics summary={summary} />}
    </main>
    {editing && <CompanyModal company={editing} onClose={() => setEditing(null)} onSave={data => updateCompany(editing, data)} />}
    {addingJob !== undefined && <JobModal companies={companies} initialCompany={addingJob || undefined} onClose={() => setAddingJob(undefined)} onSave={saveJob} />}
  </div>;
}
