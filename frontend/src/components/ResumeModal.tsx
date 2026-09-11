import { getGenerationTasks, subscribeGeneration, runResumeGeneration } from "../lib/resumeGeneration";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Download, Eye, FileCode2, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import { downloadBlob } from "../lib/resumeFiles";
import type { Application, ApplicationStage, Company, FeatureStatus, ResumeVersionRead } from "../types";

const stages: ApplicationStage[] = ["Applied", "OA", "Interview", "Rejected", "Offer"];
const filename = (value: string, ext: string) => (value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "resume") + "." + ext;
const emptyForm = () => ({ job_title: "", job_description: "", notes: "", application_stage: "Applied" as ApplicationStage });

export function ResumeModal(props: Parameters<typeof CompanyResumeModal>[0]) {
  return <CompanyResumeModal key={props.company.id} {...props} />;
}

function CompanyResumeModal({ company, features, onClose, onSaved }: {
  company: Company; features: FeatureStatus | null; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [records, setRecords] = useState<Application[]>([]);
  const [savedVersions, setSavedVersions] = useState<ResumeVersionRead[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [targetIds, setTargetIds] = useState<number[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [resumeName, setResumeName] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [editing, setEditing] = useState<ResumeVersionRead | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [refineInstruction, setRefineInstruction] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const companyRef = useRef(company.id);
  const loadRevision = useRef(0);
  companyRef.current = company.id;

  // Scope even during company switches, before the next load completes.
  const apps = records.filter(app => app.company_id === company.id);
  const versions = savedVersions.filter(version => version.company_id === company.id);
  const visibleApps = apps;
  const targets = targetIds.filter(id => visibleApps.some(app => app.id === id));
  const selected = apps.find(app => app.id === selectedId) || null;
  const tasks = useSyncExternalStore(subscribeGeneration, getGenerationTasks);
  const task = tasks.find(item => item.companyId === company.id);
  const generating = task?.status === "running";
  const locked = generating || !!busy;
  const aiAvailable = features?.ai_enabled && features.ai_configured;
  const groups = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; versions: ResumeVersionRead[] }>();
    for (const version of savedVersions.filter(item => item.company_id === company.id)) {
      const id = version.resume_group_id || "company:" + company.id + "/application:" + version.application_id;
      if (!grouped.has(id)) grouped.set(id, { id, name: version.resume_title || version.job_title || "Resume", versions: [] });
      grouped.get(id)!.versions.push(version);
    }
    return [...grouped.values()];
  }, [savedVersions, company.id]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const load = async (nextId = selectedId) => {
    const revision = ++loadRevision.current;
    const nextApps = await api.applications(company.id);
    const nextVersions = await api.companyResumes(company.id);
    if (companyRef.current !== company.id || revision !== loadRevision.current) return;
    setRecords(nextApps); setSavedVersions(nextVersions);
    const id = nextApps.some(app => app.id === nextId) ? nextId : nextApps[0]?.id ?? null;
    setSelectedId(id);
    setTargetIds(current => {
      const kept = current.filter(target => nextApps.some(app => app.id === target));
      return selectedId === null && id !== null && !current.length ? [id] : kept;
    });
  };
  useEffect(() => { load(selectedId ?? task?.applicationId ?? null).catch(reason => setError(String(reason))); }, [company.id, task]);
  useEffect(() => {
    setEditing(null);
    setForm(selected ? { job_title: selected.job_title, job_description: selected.job_description, notes: selected.notes, application_stage: selected.application_stage } : emptyForm());
  }, [selectedId, company.id]);
  useEffect(() => {
    setTargetIds([]); setResumeName(""); setEditing(null);
    setRenaming(null); setPreviewUrl(""); setError("");
  }, [company.id]);

  const mutate = async (action: () => Promise<unknown>, nextId = selectedId) => {
    setBusy("save"); setError("");
    try { await action(); await load(nextId); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Update failed"); }
    finally { setBusy(""); }
  };
  const saveApplication = async () => {
    setBusy("save"); setError("");
    try {
      const saved = selected ? await api.updateApplication(selected.id, form)
        : await api.createApplication({ company_id: company.id, job_title: form.job_title, job_description: form.job_description, notes: form.notes });
      if (!selected) await api.updateApplication(saved.id, { application_stage: form.application_stage });
      await load(saved.id); await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Save failed"); }
    finally { setBusy(""); }
  };
  const newApplication = () => {
    setSelectedId(null); setTargetIds([]); setEditing(null); setForm(emptyForm());
  };
  const generate = async () => {
    setError("");
    await runResumeGeneration(company, async () => {
      if (targets.length) {
        if (selected && targets.includes(selected.id)) await api.updateApplication(selected.id, form);
        return targets[0];
      }
      const app = await api.createApplication({ company_id: company.id, job_title: form.job_title, job_description: form.job_description, notes: form.notes });
      await api.updateApplication(app.id, { application_stage: form.application_stage });
      return app.id;
    }, id => api.generateResumeVersion(id, extraInstructions, targets.length ? targets : [id], resumeName));
    await onSaved();
  };
  const versionLabel = (version: ResumeVersionRead) => (version.resume_title || version.job_title || "Resume") + " / v" + version.version_number;
  const preview = async (version: ResumeVersionRead) => {
    const record = await api.getResumeVersion(version.id);
    if (!record?.pdf_file || record.company_id !== company.id) return;
    setPreviewName(versionLabel(version)); setPreviewUrl(URL.createObjectURL(record.pdf_file));
  };
  const download = async (version: ResumeVersionRead, ext: "pdf" | "tex") => {
    const record = await api.getResumeVersion(version.id);
    if (!record || record.company_id !== company.id) return;
    const baseName = company.name + "-" + (version.resume_title || "resume") + "-v" + version.version_number;
    if (ext === "pdf" && record.pdf_file) downloadBlob(record.pdf_file, filename(baseName, "pdf"));
    if (ext === "tex" && record.tex_source) downloadBlob(new Blob([record.tex_source], { type: "application/x-tex;charset=utf-8" }), filename(baseName, "tex"));
  };
  const deleteVersion = (version: ResumeVersionRead) => {
    if (confirm("Delete " + versionLabel(version) + "? All assignments to this version will be cleared; applications are kept.")) void mutate(() => api.deleteResumeVersion(version.id));
  };
  const deleteApplication = () => {
    if (selected && confirm("Delete application " + (selected.job_title || "Untitled") + "? Saved resumes will be kept.")) void mutate(() => api.deleteApplication(selected.id), null);
  };
  const editVersion = (version: ResumeVersionRead) => {
    setEditing(version); setEditedContent(JSON.stringify(version.structured_resume, null, 2)); setRefineInstruction(""); setError("");
  };
  const saveRefinement = async (ai: boolean) => {
    if (!editing || !selected) return;
    const applicationId = selected.id;
    setError("");
    if (ai) {
      await runResumeGeneration(company, async () => applicationId, id => api.refineResumeVersion(editing.id, id, editedContent, refineInstruction));
      if (getGenerationTasks().find(item => item.companyId === company.id)?.status === "completed") setEditing(null);
    } else {
      setBusy("refine");
      try { await api.refineResumeVersion(editing.id, applicationId, editedContent); setEditing(null); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Refinement failed"); }
      finally { setBusy(""); }
    }
    await load(applicationId); await onSaved();
  };

  return <>
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal resume-modal company-resume-modal" onMouseDown={event => event.stopPropagation()} aria-label={company.name + " applications and resumes"}>
        <div className="modal-head"><div><span className="eyebrow">Applications & resumes</span><h2>{company.name}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></div>
        <div className="resume-workspace">
          <div className="resume-inputs">
            <section className="company-application-list">
              <div className="resume-section-heading"><h3>Applications</h3><button className="button ghost compact-button" disabled={locked} onClick={newApplication}>+ New</button></div>
              <div className="company-application-rows">
                {visibleApps.map(app => {
                  const assigned = versions.find(version => version.id === app.assigned_resume_version_id);
                  return <article className={"company-application-row" + (selectedId === app.id ? " active" : "")} key={app.id}>
                    <input type="checkbox" aria-label={"Select " + (app.job_title || "Untitled role")} checked={targets.includes(app.id)} disabled={locked} onChange={event => setTargetIds(current => event.target.checked ? [...current, app.id] : current.filter(id => id !== app.id))} />
                    <button className="application-detail-button" disabled={locked} onClick={() => setSelectedId(app.id)}>
                      <strong>{app.job_title || "Untitled role"}</strong><small>{app.application_stage}</small>
                      <span>{assigned ? versionLabel(assigned) : app.assigned_resume_version_id ? "Previously assigned resume" : "No resume assigned"}</span>
                    </button>
                  </article>;
                })}
                {!visibleApps.length && <p className="empty-copy">No applications yet.</p>}
              </div>
              <small>{targets.length} selected for generation or assignment</small>
            </section>
            <details className="application-editor" open>
              <summary>{selected ? "Edit application" : "New application"}</summary>
              <div className="application-editor-fields">
                <label>Job title<input value={form.job_title} disabled={locked} onChange={event => setForm(current => ({ ...current, job_title: event.target.value }))} placeholder="Software Engineering Intern" /></label>
                <label>Stage<select value={form.application_stage} disabled={locked} onChange={event => setForm(current => ({ ...current, application_stage: event.target.value as ApplicationStage }))}>{stages.map(stage => <option key={stage}>{stage}</option>)}</select></label>
                <label>Job description<textarea rows={6} value={form.job_description} disabled={locked} onChange={event => setForm(current => ({ ...current, job_description: event.target.value }))} placeholder="Paste the JD..." /></label>
                <label>Notes<textarea rows={2} value={form.notes} disabled={locked} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></label>
                <div className="resume-actions"><button className="button ghost" disabled={locked} onClick={saveApplication}>Save application</button>{selected && <button className="button ghost delete" disabled={locked} onClick={deleteApplication}>Delete</button>}{!!selected?.assigned_resume_version_id && <button className="button ghost" disabled={locked} onClick={() => mutate(() => api.assignResume(selected!.id, null))}>Unassign resume</button>}</div>
              </div>
            </details>
          </div>
          <div className="resume-output">
            <section className="resume-generation-panel">
              <h3>Generate shared resume</h3>
              <label>Resume name<input value={resumeName} disabled={locked} onChange={event => setResumeName(event.target.value)} placeholder={selected?.job_title || "e.g. Backend engineering"} /></label>
              <label>Extra instructions<textarea rows={2} value={extraInstructions} disabled={locked} onChange={event => setExtraInstructions(event.target.value)} placeholder="Optional tailoring preferences" /></label>
              {!aiAvailable && <p className="inline-error">Save AI settings before generating resumes.</p>}
              <button className="button primary" disabled={!aiAvailable || locked || (selected ? !targets.length : !targets.length && form.job_description.trim().length < 20)} onClick={generate}><Sparkles size={15} />{generating ? "Tailoring and compiling..." : targets.length ? "Generate for " + targets.length + " selected" : "Generate resume"}</button>
            </section>
            {task && !generating && <p role="status" className={task.status === "failed" ? "inline-error" : "compiler-note"}>{task.status === "completed" ? "Resume saved." + (task.estimatedCostUsd !== undefined ? " Estimated cost: US$" + task.estimatedCostUsd.toFixed(4) : " Cost unavailable.") : "Generation failed: " + task.error}</p>}
            {error && <p className="inline-error">{error}</p>}
            <section className="company-resume-groups">
              <h3>Saved resumes</h3>
              {!groups.length && <p className="empty-copy">No saved resumes for this company yet.</p>}
              {groups.map(group => {
                const users = apps.filter(app => group.versions.some(version => version.id === app.assigned_resume_version_id));
                return <section className="named-resume" key={group.id}>
                  <div className="resume-section-heading">
                    {renaming === group.id ? <form className="resume-rename" onSubmit={event => { event.preventDefault(); void mutate(async () => { await api.renameResumeGroup(company.id, group.id, renameText); setRenaming(null); }); }}><input aria-label="Resume group name" value={renameText} onChange={event => setRenameText(event.target.value)} autoFocus /><button className="button ghost compact-button" disabled={locked || !renameText.trim()}>Save</button><button type="button" className="button ghost compact-button" onClick={() => setRenaming(null)}>Cancel</button></form>
                      : <><h4>{group.name}</h4><button className="button ghost compact-button" disabled={locked} onClick={() => { setRenaming(group.id); setRenameText(group.name); }}>Rename</button></>}
                  </div>
                  <p className="resume-usage">{users.length ? "Used by: " + users.map(app => app.job_title || "Untitled role").join(", ") : "Not currently assigned"}</p>
                  {group.versions.map(version => {
                    const assignedApps = apps.filter(app => app.assigned_resume_version_id === version.id);
                    return <article className="company-resume-version" key={version.id}>
                      <div><strong>Version {version.version_number}</strong><small>{new Date(version.created_at).toLocaleString()} / {version.provider} / {version.model}{version.reasoning_effort ? " / " + version.reasoning_effort : ""}{version.ai_usage ? " / est. $" + version.ai_usage.estimated_usd.toFixed(4) : ""}</small></div>
                      <p className="resume-usage">{assignedApps.length ? assignedApps.map(app => app.job_title || "Untitled role").join(", ") : "Not assigned"}</p>
                      <div className="resume-version-actions">
                        <button disabled={locked || !targets.length} onClick={() => mutate(() => api.assignResumeApplications(company.id, version.id, targets))}>Use for selected ({targets.length})</button>
                        <button disabled={locked || !selected} title={!selected ? "Open an application to refine this version" : ""} onClick={() => editVersion(version)}>Edit / AI refine</button>
                        <button onClick={() => preview(version)}><Eye size={13} /> Preview</button>
                        <button onClick={() => download(version, "pdf")}><Download size={13} /> PDF</button>
                        <button onClick={() => download(version, "tex")}><FileCode2 size={13} /> .tex</button>
                        <button className="delete" disabled={locked} onClick={() => deleteVersion(version)}><Trash2 size={13} /> Delete</button>
                      </div>
                    </article>;
                  })}
                </section>;
              })}
            </section>
            {editing && selected && <section className="resume-refinement"><h3>Refine {versionLabel(editing)}</h3><p>Saves a new version for {selected.job_title || "this application"}. Other assignments stay unchanged.</p><label>Structured resume content (JSON)<textarea rows={18} spellCheck={false} value={editedContent} disabled={locked} onChange={event => setEditedContent(event.target.value)} /></label><label>AI refinement instruction<textarea rows={3} value={refineInstruction} disabled={locked} onChange={event => setRefineInstruction(event.target.value)} /></label><div className="resume-actions"><button className="button primary" disabled={locked} onClick={() => saveRefinement(false)}>{busy === "refine" ? "Compiling..." : "Save manual edit as new version"}</button><button className="button ghost" disabled={!aiAvailable || !refineInstruction.trim() || locked} onClick={() => saveRefinement(true)}>AI refine as new version</button><button className="button ghost" disabled={locked} onClick={() => setEditing(null)}>Cancel</button></div></section>}
          </div>
        </div>
      </section>
    </div>
    {previewUrl && <div className="pdf-preview-backdrop" onMouseDown={() => setPreviewUrl("")}><section className="pdf-preview" onMouseDown={event => event.stopPropagation()}><div className="modal-head"><h2>{previewName}</h2><button className="icon-button" aria-label="Close PDF" onClick={() => setPreviewUrl("")}><X size={20} /></button></div><iframe title={previewName} src={previewUrl} /></section></div>}
  </>;
}
