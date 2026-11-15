import { useRef, useState } from "react";
import { Download, Play, Upload } from "lucide-react";
import { executeConsoleCommand } from "../api/console";
import { api } from "../api/client";
import { downloadBlob } from "../lib/resumeFiles";

const examples = {
  "Find companies": { action: "query", entity: "companies", search: "Autodesk" },
  "Find applications": { action: "query", entity: "applications", search: "Autodesk", include_jd: true },
  "List resumes": { action: "query", entity: "resumes" },
  "Batch update": { action: "batch", request_id: "replace-with-unique-request-id", operations: [{ action: "update_application", id: 123, changes: { application_stage: "OA", assessment_status: "completed" } }] },
  "Upload PDF": { action: "batch", request_id: "replace-with-unique-upload-id", operations: [{ action: "import_resume", company_id: 123, file: "Company_Yutong_Zha_Resume.pdf", application_ids: [456] }] },
  "Assign resume": { action: "batch", request_id: "replace-with-unique-assignment-id", operations: [{ action: "assign_resume", resume_id: 123, application_ids: [456, 789] }] },
  "Create submitted role": { action: "batch", request_id: "replace-with-unique-submission-id", operations: [{ action: "create_application", company_id: 123, data: { requisition_id: "REPLACE-ME", job_title: "Software Engineer Intern", job_description: "Paste the complete JD here", submission_evidence: "Paste verified submission evidence here" } }] },
  "Recent changes": { action: "query", entity: "history", limit: 10 },
};
type Example = keyof typeof examples;
export function JsonConsole({ onSaved }: { onSaved: () => Promise<void> }) {
  const [source, setSource] = useState(JSON.stringify(examples["Find companies"], null, 2));
  const [files, setFiles] = useState<File[]>([]);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const run = async (preview: boolean) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(""); setOutput("");
    try {
      const response = await executeConsoleCommand(source, files, preview);
      setOutput(JSON.stringify(response, null, 2));
      if (response.mode === "applied") {
        try { await onSaved(); } catch { setError("Changes were saved, but the page could not refresh. Reload to see them; do not resubmit with a new request ID."); }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Command failed. No batch changes saved."); }
    finally { running.current = false; setBusy(false); }
  };
  return <section className="content-panel json-console" aria-label="JSON Console">
    <div className="console-heading"><div><h2>JSON Console</h2><p>Query and update your browser-local tracker. No AI calls or external uploads.</p></div>
      <button className="button ghost" disabled={busy} onClick={async () => {
        setError(""); setBusy(true);
        try { downloadBlob(await api.exportBackup(), `InternRadar-backup-${new Date().toISOString().slice(0, 10)}.zip`); }
        catch (reason) { setError(String(reason)); } finally { setBusy(false); }
      }}><Download size={14} /> Download backup</button>
    </div>
    <div className="console-tools">
      <label>Example<select aria-label="Console example" defaultValue="Find companies" disabled={busy} onChange={event => setSource(JSON.stringify(examples[event.target.value as Example], null, 2))}>{Object.keys(examples).map(name => <option key={name}>{name}</option>)}</select></label>
      <button className="button ghost" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={14} /> Attach PDFs</button>
      <input ref={fileInput} type="file" accept=".pdf,application/pdf" multiple hidden onChange={event => {
        setFiles(Array.from(event.target.files || [])); event.target.value = "";
      }} />
      <small>Example IDs are placeholders. Query first; replace them with real IDs.</small>
    </div>
    {files.length > 0 && <div className="console-files"><span>Selected, not saved: {files.map(file => `${file.name} (${Math.ceil(file.size / 1024)} KB)`).join(", ")}</span><button className="button ghost" disabled={busy} onClick={() => setFiles([])}>Clear files</button></div>}
    <label className="console-editor">Command JSON<textarea aria-label="Command JSON" spellCheck={false} value={source} disabled={busy} onChange={event => setSource(event.target.value)} onKeyDown={event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void run(false); }
    }} /></label>
    <div className="console-actions"><button className="button ghost" disabled={busy} onClick={() => void run(true)}>Preview without saving</button><button className="button primary" disabled={busy} onClick={() => void run(false)}><Play size={14} /> {busy ? "Working..." : "Run command"}</button><small>Ctrl/Cmd + Enter to run. A batch saves completely or not at all.</small></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="console-result"><div className="console-heading"><h3>Result</h3><button className="button ghost" disabled={!output || busy} onClick={() => downloadBlob(new Blob([output], { type: "application/json" }), "InternRadar-command-result.json")}><Download size={14} /> Download result</button></div><pre aria-label="Command result" aria-live="polite" tabIndex={0}>{output || "Results will appear here. Queries and previews do not change records."}</pre></div>
    <details className="console-help"><summary>Command reference and safety</summary>
      <p>Use query with entity companies, applications, resumes or history. Optional filters: search, company_id, ids, limit (up to 200), offset. Applications also accept stage and include_jd.</p>
      <p>Writes use batch with a unique request_id and up to 50 operations. Repeating the same request is safe; reusing its ID for different content is rejected. There is no delete, restore, script execution or API-key access command.</p>
      <p>update_application targets an exact id, or job: {JSON.stringify({ company_id: 123, requisition_id: "ABC" })}. changes accepts job_title, job_description, notes, requisition_id, job_url, location, application_email, submitted_at, submission_evidence, application_stage, stage_history, assessment_status, assessment_url, assessment_deadline and reference_status. Omitted fields stay unchanged. Notes replace the current notes; query them first. Historical milestones are retained. An optional expected_updated_at rejects stale edits.</p>
      <p>create_application requires company_id and data containing requisition_id, job_title and the full job_description. It records a submitted application, not a draft. Do not use it for unsubmitted roles. Duplicate requisitions are rejected; legacy title/notes matches need review by ID.</p>
      <p>import_resume requires company_id and file matching one attached PDF filename exactly (up to 10 MB); title and application_ids are optional. Files remain local. Identical uploaded content is reused within the same company. Uploaded PDFs are kept unchanged and appear in the existing resume list; structured editing is unavailable.</p>
      <p>assign_resume uses an exact resume_id and application_ids; null removes the association without deleting files. Cross-company assignments are rejected. This association records your choice; it does not upload to an employer or prove submission.</p>
    </details>
  </section>;
}
