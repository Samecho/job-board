import { getGenerationTasks, subscribeGeneration, runResumeGeneration } from "../lib/resumeGeneration";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Eye, FileCode2, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import { COMPANY_CATALOG } from "../data/catalog";
import { downloadBlob } from "../lib/resumeFiles";
import type { Application, ApplicationStage, Company, FeatureStatus, ResumeVersionRead } from "../types";

const stages: ApplicationStage[] = ["Applied", "OA", "Interview", "Rejected", "Offer"];
const filename = (value: string, ext: string) => `${value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "resume"}.${ext}`;

export function ResumeModal({ company, features, onClose, onSaved }: {
  company: Company;
  features: FeatureStatus | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [versionRevision, setVersionRevision] = useState(0);
  const [versions, setVersions] = useState<ResumeVersionRead[]>([]);
  const [form, setForm] = useState({ job_title: "", job_description: "", notes: "", application_stage: "Applied" as ApplicationStage });
  const [extraInstructions, setExtraInstructions] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [availableVersions, setAvailableVersions] = useState<ResumeVersionRead[]>([]);
  const [targetIds, setTargetIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<ResumeVersionRead | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [refineInstruction, setRefineInstruction] = useState("");

  const tasks = useSyncExternalStore(subscribeGeneration, getGenerationTasks);
  const task = tasks.find(item => item.companyId === company.id);
  const generating = task?.status === "running";
  const selected = apps.find(app => app.id === selectedId) || null;
  const aiAvailable = features?.ai_enabled && features.ai_configured;

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const load = async (nextId = selectedId) => {
    const nextApps = await api.applications(company.id);
    setApps(nextApps);
    setAllApps(await api.applications());
    setAvailableVersions(await api.resumes());
    const id = nextApps.some(app => app.id === nextId) ? nextId : nextApps[0]?.id ?? null;
    setSelectedId(id);
    setVersionRevision(value => value + 1);

  };

  useEffect(() => { load(selectedId ?? task?.applicationId ?? null); }, [company.id, task]);
  useEffect(() => { setTargetIds(selectedId ? [selectedId] : []); setEditing(null); }, [selectedId]);
  useEffect(() => {
    let active = true;
    setVersions([]);
    if (selectedId) api.resumeVersions(selectedId).then(items => { if (active) setVersions(items); }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, [selectedId, task, versionRevision]);
  useEffect(() => {
    if (!selected) return setForm({ job_title: "", job_description: "", notes: "", application_stage: "Applied" });
    setForm({
      job_title: selected.job_title,
      job_description: selected.job_description,
      notes: selected.notes,
      application_stage: selected.application_stage,
    });
  }, [selectedId, apps.length]);

  const saveApplication = async () => {
    setBusy("save"); setError("");
    try {
      const saved = selected
        ? await api.updateApplication(selected.id, form)
        : await api.createApplication({ company_id: company.id, job_title: form.job_title, job_description: form.job_description, notes: form.notes });
      if (!selected) await api.updateApplication(saved.id, { application_stage: form.application_stage });
      await load(saved.id); await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Save failed"); }
    finally { setBusy(""); }
  };

  const newApplication = () => {
    setSelectedId(null);
    setVersions([]);
    setForm({ job_title: "", job_description: "", notes: "", application_stage: "Applied" });
  };

  const generate = async () => {
    setError("");
    await runResumeGeneration(company, async () => {
      if (!selected && targetIds.length) return targetIds[0];
      let app = selected;
      if (!app) {
        app = await api.createApplication({ company_id: company.id, job_title: form.job_title, job_description: form.job_description, notes: form.notes });
        app = await api.updateApplication(app.id, { application_stage: form.application_stage });
      } else {
        app = await api.updateApplication(app.id, form);
      }
      return targetIds[0] ?? app.id;
    }, id => api.generateResumeVersion(id, extraInstructions, targetIds.length ? targetIds : [id]));
    await onSaved();
  };
  const preview = async (version: ResumeVersionRead) => {
    const record = await api.getResumeVersion(version.id);
    if (!record?.pdf_file) return;
    setPreviewName(`${company.name} - ${form.job_title || "Resume"} - Version ${version.version_number}`);
    setPreviewUrl(URL.createObjectURL(record.pdf_file));
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewName("");
  };

  const download = async (version: ResumeVersionRead, ext: "pdf" | "tex") => {
    const record = await api.getResumeVersion(version.id);
    if (!record) return;
    const baseName = `${company.name}-${form.job_title || "resume"}-v${version.version_number}`;
    if (ext === "pdf" && record.pdf_file) downloadBlob(record.pdf_file, filename(baseName, "pdf"));
    if (ext === "tex" && record.tex_source) downloadBlob(new Blob([record.tex_source], { type: "application/x-tex;charset=utf-8" }), filename(baseName, "tex"));
  };

  const deleteVersion = async (version: ResumeVersionRead) => {
    if (!confirm(`Delete Version ${version.version_number}? This removes it from all applications sharing it. Applications are kept.`)) return;
    await api.deleteResumeVersion(version.id);
    await load(selectedId); await onSaved();
  };

  const deleteApplication = async () => {
    if (!selected || !confirm(`Delete application ${selected.job_title || "Untitled"}? Saved resume versions will be kept.`)) return;
    await api.deleteApplication(selected.id);
    await load(null); await onSaved();
  };

  const editVersion = (version: ResumeVersionRead) => {
    setEditing(version); setEditedContent(JSON.stringify(version.structured_resume, null, 2)); setRefineInstruction(""); setError("");
  };
  const saveRefinement = async (ai: boolean) => {
    if (!editing || !selectedId) return;
    const editingApplicationId = selectedId;
    setError("");
    if (ai) {
      await runResumeGeneration(company, async () => editingApplicationId, id => api.refineResumeVersion(editing.id, id, editedContent, refineInstruction));
      if (getGenerationTasks().find(item => item.companyId === company.id)?.status === "completed") setEditing(null);
    } else {
      setBusy("refine");
      try { await api.refineResumeVersion(editing.id, selectedId, editedContent); setEditing(null); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Refinement failed"); }
      finally { setBusy(""); }
    }
    await load(selectedId); await onSaved();
  };
  const changeAssignment = async (value: string) => {
    if (!selectedId) return;
    setBusy("assign"); setError("");
    try { await api.assignResume(selectedId, value ? Number(value) : null); await load(selectedId); await onSaved(); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(""); }
  };

  return <>
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal resume-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">Applications and resume versions</span><h2>{company.name}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
        <div className="resume-workspace">
          <div className="resume-inputs">
            <div className="app-picker"><span className="eyebrow">Applications</span><button className={!selected ? "active" : ""} onClick={newApplication}>+ New application</button>{apps.map(app => <button key={app.id} className={selectedId === app.id ? "active" : ""} onClick={() => setSelectedId(app.id)}>{app.job_title || "Untitled role"}<small>{app.application_stage}</small></button>)}</div>
            <label>Job title<input value={form.job_title} onChange={event => setForm(current => ({ ...current, job_title: event.target.value }))} placeholder="Software Engineering Intern" /></label>
            <label>Job description<textarea rows={10} value={form.job_description} onChange={event => setForm(current => ({ ...current, job_description: event.target.value }))} placeholder="Paste the full JD here..." /></label>
            <label>Application stage<select value={form.application_stage} onChange={event => setForm(current => ({ ...current, application_stage: event.target.value as ApplicationStage }))}>{stages.map(stage => <option key={stage}>{stage}</option>)}</select></label>
            <label>Notes<textarea rows={3} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></label>
            <div className="resume-actions"><button className="button ghost" disabled={busy === "save" || generating} onClick={saveApplication}>{busy === "save" ? "Saving..." : "Save application"}</button>{selected && <button className="button ghost delete" disabled={generating} onClick={deleteApplication}>Delete application</button>}</div>
          </div>
          <div className="resume-output">
            {selected && <label>Assigned resume<select aria-label="Assigned resume" value={selected.assigned_resume_version_id ?? ""} disabled={generating || !!busy} onChange={event => changeAssignment(event.target.value)}><option value="">None</option>{availableVersions.map(version => <option key={version.id} value={version.id}>{version.company_name} / {version.job_title || "Resume"} / v{version.version_number} (#{version.id})</option>)}</select></label>}
            {!!allApps.length && <fieldset className="resume-targets"><legend>Generate one resume for selected applications</legend>{allApps.map(app => <label key={app.id}><input type="checkbox" checked={targetIds.includes(app.id)} disabled={generating} onChange={event => setTargetIds(current => event.target.checked ? [...current, app.id] : current.filter(id => id !== app.id))} /><span>{COMPANY_CATALOG.find(item => item.id === app.company_id)?.name || "Company"} / {app.job_title || "Untitled role"}</span></label>)}</fieldset>}
            <label>Extra instructions<textarea rows={4} value={extraInstructions} onChange={event => setExtraInstructions(event.target.value)} placeholder="Optional truthful tailoring preferences..." /></label>
            {!aiAvailable && <p className="inline-error">Save AI settings before generating resumes.</p>}
            <button className="button primary" disabled={!aiAvailable || (!targetIds.length && form.job_description.trim().length < 20) || generating || !!busy || (!!selected && !targetIds.length)} onClick={generate}><Sparkles size={15} /> {generating ? "Tailoring and compiling..." : "Generate new version"}</button>
            {task && !generating && <p role="status" className={task.status === "failed" ? "inline-error" : "compiler-note"}>{task.status === "completed" ? `Resume saved.${task.estimatedCostUsd !== undefined ? ` Estimated cost: US$${task.estimatedCostUsd.toFixed(4)}` : " Cost unavailable."}` : `Generation failed: ${task.error}`}</p>}
            {error && <p className="inline-error">{error}</p>}
            <div className="resume-history"><span className="eyebrow">Resume versions</span>{versions.length ? versions.map(version => <article key={version.id}><div><strong>Version {version.version_number}</strong><span>{version.provider} · {version.model}{version.reasoning_effort ? ` / ${version.reasoning_effort}` : ""}{version.ai_usage ? ` · est. $${version.ai_usage.estimated_usd.toFixed(4)} (${version.ai_usage.input_tokens} in / ${version.ai_usage.output_tokens} out incl. ${version.ai_usage.reasoning_tokens} thinking)` : ""} · {new Date(version.created_at).toLocaleString()}</span></div><div><button disabled={generating || !!busy} onClick={() => editVersion(version)}>Edit / AI refine</button><button onClick={() => preview(version)}><Eye size={13} /> Preview PDF</button><button onClick={() => download(version, "pdf")}><Download size={13} /> PDF</button><button onClick={() => download(version, "tex")}><FileCode2 size={13} /> .tex</button><button className="delete" onClick={() => deleteVersion(version)}><Trash2 size={13} /> Delete</button></div></article>) : <p>No resume versions for this application yet.</p>}</div>
            {editing && <section className="resume-refinement"><h3>Refine Version {editing.version_number}</h3><p>Edits save as a new version assigned to this application. Other applications keep their current assignment.</p><label>Structured resume content (JSON)<textarea rows={22} spellCheck={false} value={editedContent} disabled={generating || !!busy} onChange={event => setEditedContent(event.target.value)} /></label><label>AI refinement instruction<textarea rows={3} value={refineInstruction} disabled={generating || !!busy} onChange={event => setRefineInstruction(event.target.value)} placeholder="For example: shorten the first bullet without changing its metrics" /></label><div className="resume-actions"><button className="button primary" disabled={generating || !!busy} onClick={() => saveRefinement(false)}>{busy === "refine" ? "Compiling..." : "Save manual edit as new version"}</button><button className="button ghost" disabled={!aiAvailable || !refineInstruction.trim() || generating || !!busy} onClick={() => saveRefinement(true)}>AI refine as new version</button><button className="button ghost" disabled={generating || !!busy} onClick={() => setEditing(null)}>Cancel</button></div></section>}
          </div>
        </div>
      </section>
    </div>
    {previewUrl && <div className="pdf-preview-backdrop" onMouseDown={closePreview}>
      <section className="pdf-preview" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">Compiled PDF preview</span><h2>{previewName}</h2></div><button className="icon-button" onClick={closePreview}><X size={20} /></button></div>
        <iframe title={previewName} src={previewUrl} />
      </section>
    </div>}
  </>;
}
