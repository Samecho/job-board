import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ApplicationStatus, Company, CompanyUpdate } from "../types";

const statuses: ApplicationStatus[] = [
  "Not Applied", "Watching", "Interested", "Applied", "OA",
  "Interview", "Rejected", "Offer", "Hidden",
];

export function CompanyModal({
  company,
  onClose,
  onSave,
}: {
  company: Company;
  onClose: () => void;
  onSave: (data: CompanyUpdate) => Promise<void>;
}) {
  const [form, setForm] = useState<CompanyUpdate>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm({ ...company }), [company]);
  const set = (key: keyof CompanyUpdate, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try { await onSave(form); onClose(); } finally { setSaving(false); }
      }}>
        <div className="modal-head">
          <div><span className="eyebrow">Company profile</span><h2>Edit {company.name}</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="form-grid">
          <label>Status<select value={form.application_status} onChange={(e) => set("application_status", e.target.value)}>
            {statuses.map((status) => <option key={status}>{status}</option>)}
          </select></label>
          <label>Match score<input type="number" min="0" max="100" value={form.match_score ?? 0} onChange={(e) => set("match_score", +e.target.value)} /></label>
          <label>Open internships<input type="number" min="0" value={form.intern_open_count ?? 0} onChange={(e) => set("intern_open_count", +e.target.value)} /></label>
          <label>Tier<select value={form.tier} onChange={(e) => set("tier", e.target.value)}>{["S+", "S", "A+", "A", "B+", "B", "C+", "C", "D+", "D"].map(t => <option key={t}>{t}</option>)}</select></label>
          <label>Pay minimum<input type="number" min="0" placeholder="Unknown" value={form.average_intern_pay_min ?? ""} onChange={(e) => set("average_intern_pay_min", e.target.value ? +e.target.value : null)} /></label>
          <label>Pay maximum<input type="number" min="0" placeholder="Unknown" value={form.average_intern_pay_max ?? ""} onChange={(e) => set("average_intern_pay_max", e.target.value ? +e.target.value : null)} /></label>
          <label>Currency<select value={form.pay_currency} onChange={(e) => set("pay_currency", e.target.value)}>{["USD", "CAD", "EUR", "GBP"].map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Pay period<select value={form.pay_period} onChange={(e) => set("pay_period", e.target.value)}>{["unknown", "hourly", "monthly", "yearly"].map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="full">Locations<input value={form.main_locations ?? ""} onChange={(e) => set("main_locations", e.target.value)} /></label>
          <label className="full">Careers URL<input type="url" value={form.career_url ?? ""} onChange={(e) => set("career_url", e.target.value)} placeholder="https://..." /></label>
          <label className="full">Tags<input value={form.tags ?? ""} onChange={(e) => set("tags", e.target.value)} placeholder="AI, backend, Canada" /></label>
          <label className="full">Notes<textarea rows={4} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={() => set("application_status", "Not Applied")}>Reset status</button>
          <button className="button primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
