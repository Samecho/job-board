import { useEffect, useState } from "react";
import { Copy, Download, Sparkles, X } from "lucide-react";
import { api } from "../api/client";
import type { Company, FeatureStatus, GeneratedResume } from "../types";

const filename = (value: string) =>
  `${value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "resume"}.tex`;

export function downloadTex(name: string, latex: string) {
  const url = URL.createObjectURL(new Blob([latex], { type: "application/x-tex" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename(name); link.click();
  URL.revokeObjectURL(url);
}

export function ResumeModal({ company, features, onClose, onSaved }: {
  company: Company;
  features: FeatureStatus | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [jobTitle, setJobTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [latex, setLatex] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<GeneratedResume[]>([]);
  const [busy, setBusy] = useState<"generate" | "save" | "">("");
  const [error, setError] = useState("");

  const loadHistory = () => api.companyResumes(company.id).then(setHistory);
  useEffect(() => { loadHistory(); }, [company.id]);
  const aiAvailable = features?.ai_enabled && features.ai_configured;

  const generate = async () => {
    setBusy("generate"); setError("");
    try {
      const result = await api.generateResume({
        company_id: company.id,
        job_title: jobTitle,
        jd_text: jdText,
        extra_instructions: instructions,
      });
      setLatex(result.generated_latex);
      setResumeName(result.suggested_resume_name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Generation failed");
    } finally { setBusy(""); }
  };

  const save = async () => {
    setBusy("save"); setError("");
    try {
      await api.saveResume(company.id, {
        job_title: jobTitle,
        jd_text: jdText,
        generated_latex: latex,
        resume_name: resumeName,
        notes,
      });
      await loadHistory(); await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed");
    } finally { setBusy(""); }
  };

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal resume-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">Tailored resume</span><h2>{company.name}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="resume-workspace">
        <div className="resume-inputs">
          <label>Job title<input value={jobTitle} onChange={event => setJobTitle(event.target.value)} placeholder="Software Engineering Intern" /></label>
          <label>Job description<textarea rows={12} value={jdText} onChange={event => setJdText(event.target.value)} placeholder="Paste the full JD here..." /></label>
          <label>Extra instructions<textarea rows={3} value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Optional truthful tailoring preferences..." /></label>
          {!aiAvailable && <p className="inline-error">Configure DeepSeek API key to generate resumes.</p>}
          <button className="button primary" disabled={!aiAvailable || jdText.trim().length < 20 || busy === "generate"} onClick={generate}><Sparkles size={15} /> {busy === "generate" ? "Generating..." : "Generate LaTeX"}</button>
        </div>
        <div className="resume-output">
          <label>Resume name<input value={resumeName} onChange={event => setResumeName(event.target.value)} placeholder="Generated after tailoring" /></label>
          <label>Generated LaTeX<textarea className="latex-editor" rows={20} value={latex} onChange={event => setLatex(event.target.value)} placeholder="Generated .tex appears here. It is not saved until you click Save." /></label>
          <label>Saved resume notes<textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></label>
          <div className="resume-actions"><button className="button ghost" disabled={!latex} onClick={() => navigator.clipboard.writeText(latex)}><Copy size={14} /> Copy</button><button className="button ghost" disabled={!latex} onClick={() => downloadTex(resumeName, latex)}><Download size={14} /> Download .tex</button><button className="button primary" disabled={!latex || !resumeName || !jdText || busy === "save"} onClick={save}>{busy === "save" ? "Saving..." : "Save resume"}</button></div>
          <small className="save-warning">Generation is temporary. Only Save resume writes it to SQLite.</small>
        </div>
      </div>
      {error && <p className="inline-error">{error}</p>}
      <div className="resume-history"><span className="eyebrow">Saved history for {company.name}</span>{history.length ? history.map(item => <article key={item.id}><div><strong>{item.resume_name}</strong><span>{item.job_title || "No job title"} · {new Date(item.created_at).toLocaleDateString()}</span></div><div><button onClick={() => { setJobTitle(item.job_title); setJdText(item.jd_text); setLatex(item.generated_latex); setResumeName(item.resume_name); setNotes(item.notes); }}>View</button><button onClick={() => navigator.clipboard.writeText(item.generated_latex)}>Copy</button><button onClick={() => downloadTex(item.resume_name, item.generated_latex)}>Download</button></div></article>) : <p>No saved resumes for this company yet.</p>}</div>
    </section>
  </div>;
}
