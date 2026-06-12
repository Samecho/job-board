import { useState } from "react";
import { X } from "lucide-react";
import type { Company, JobCreate } from "../types";

export function JobModal({ companies, initialCompany, onClose, onSave }: {
  companies: Company[];
  initialCompany?: number;
  onClose: () => void;
  onSave: (job: JobCreate) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<JobCreate>({
    company_id: initialCompany || companies[0]?.id || 0,
    title: "", location: "", job_type: "Internship", apply_url: "",
    salary_min: null, salary_max: null, currency: "USD", pay_period: "unknown",
    status: "Open", deadline: null, notes: "", is_active: true,
  });
  const set = (key: keyof JobCreate, value: unknown) => setForm(v => ({ ...v, [key]: value }));
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={async (e) => {
        e.preventDefault(); setSaving(true);
        try { await onSave(form); onClose(); } finally { setSaving(false); }
      }}>
        <div className="modal-head"><div><span className="eyebrow">Manual role</span><h2>Add a job</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></div>
        <div className="form-grid">
          <label>Company<select value={form.company_id} onChange={e => set("company_id", +e.target.value)}>{companies.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>Job type<select value={form.job_type} onChange={e => set("job_type", e.target.value)}>{["Internship", "Co-op", "New Grad", "Full-time", "Other"].map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="full">Title<input required value={form.title} onChange={e => set("title", e.target.value)} placeholder="Software Engineering Intern" /></label>
          <label>Location<input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Toronto, Canada" /></label>
          <label>Deadline<input type="date" value={form.deadline || ""} onChange={e => set("deadline", e.target.value || null)} /></label>
          <label>Salary minimum<input type="number" min="0" value={form.salary_min ?? ""} onChange={e => set("salary_min", e.target.value ? +e.target.value : null)} /></label>
          <label>Salary maximum<input type="number" min="0" value={form.salary_max ?? ""} onChange={e => set("salary_max", e.target.value ? +e.target.value : null)} /></label>
          <label>Currency<select value={form.currency} onChange={e => set("currency", e.target.value)}>{["USD", "CAD", "EUR", "GBP"].map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Pay period<select value={form.pay_period} onChange={e => set("pay_period", e.target.value)}>{["unknown", "hourly", "monthly", "yearly"].map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="full">Apply URL<input type="url" value={form.apply_url} onChange={e => set("apply_url", e.target.value)} placeholder="https://..." /></label>
          <label className="full">Notes<textarea rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} /></label>
          <label className="check full"><input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} /> Active opening</label>
        </div>
        <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Adding..." : "Add job"}</button></div>
      </form>
    </div>
  );
}
