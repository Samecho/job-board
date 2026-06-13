import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Company, CompanyStatus, CompanyUpdate } from "../types";

const statuses: CompanyStatus[] = [
  "Not Applied", "Watching", "Interested", "Applied", "OA",
  "Interview", "Rejected", "Offer", "Hidden",
];

export function CompanyModal({ company, onClose, onSave }: {
  company: Company;
  onClose: () => void;
  onSave: (data: CompanyUpdate) => Promise<void>;
}) {
  const [form, setForm] = useState<CompanyUpdate>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm({
    status: company.status,
    notes: company.notes,
    link: company.link,
    main_locations: company.main_locations,
  }), [company]);

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal" onMouseDown={event => event.stopPropagation()} onSubmit={async event => {
      event.preventDefault(); setSaving(true);
      try { await onSave(form); onClose(); } finally { setSaving(false); }
    }}>
      <div className="modal-head"><div><span className="eyebrow">Company tracker</span><h2>Edit {company.name}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="form-grid">
        <label>Status<select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as CompanyStatus }))}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Locations<input value={form.main_locations || ""} onChange={event => setForm(current => ({ ...current, main_locations: event.target.value }))} placeholder="Toronto, Vancouver, Remote" /></label>
        <label className="full">Useful link<input type="url" value={form.link || ""} onChange={event => setForm(current => ({ ...current, link: event.target.value }))} placeholder="https://..." /></label>
        <label className="full">Notes<textarea rows={6} value={form.notes || ""} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></label>
      </div>
      <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
    </form>
  </div>;
}
