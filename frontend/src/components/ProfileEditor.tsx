import { masterSkills } from "../lib/technicalSkills";
import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { profileDetails } from "../lib/profileDetails";
import { Plus, Trash2 } from "lucide-react";
import type { ResumeProfileUpdate } from "../types";

function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="profile-add" onClick={onClick}><Plus size={14} />{children}</button>;
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="profile-remove" onClick={onClick}><Trash2 size={13} />{label}</button>;
}

function Section({ title, description, children, action }: { title: string; description: string; children: ReactNode; action?: ReactNode }) {
  const id = useId();
  return <section className="profile-editor-section" aria-labelledby={id}>
    <div className="profile-section-heading"><div><h3 id={id}>{title}</h3><p>{description}</p></div>{action}</div>
    <div className="profile-entry-list">{children}</div>
  </section>;
}

// Keep separators visible while typing; persist the existing array value on every edit.
function ListField({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (value: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState(value.join(", "));
  const [focused, setFocused] = useState(false);
  const serialized = value.join(", ");
  useEffect(() => { if (!focused) setDraft(serialized); }, [serialized, focused]);
  return <label className="profile-field">
    <span>{label}</span>
    <input value={draft} placeholder={placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={event => {
      setDraft(event.target.value);
      onChange(event.target.value.split(",").map(item => item.trim()).filter(Boolean));
    }} />
  </label>;
}

type ProfileSubproject = ResumeProfileUpdate["workExperiences"][number]["subprojects"][number];

function SubprojectsEditor({ subprojects, onChange }: { subprojects: ProfileSubproject[]; onChange: (value: ProfileSubproject[]) => void }) {
  const id = useId();
  const update = (index: number, patch: Partial<ProfileSubproject>) => onChange(subprojects.map((subproject, i) => i === index ? { ...subproject, ...patch } : subproject));
  return <div className="profile-subprojects">
    {subprojects.map((subproject, index) => <section className="profile-subproject-card" key={index} aria-label={`Subproject ${index + 1}`}>
      <div className="profile-entry-heading"><span>Subproject {index + 1}</span><RemoveButton label="Remove subproject" onClick={() => onChange(subprojects.filter((_, i) => i !== index))} /></div>
      <div className="profile-field"><div className="profile-entry-heading"><label htmlFor={`${id}-${index}`}>Subproject name (optional)</label><button type="button" className="profile-remove" aria-pressed={!!subproject.omitTitle} onClick={() => update(index, { name: "", omitTitle: true })}>No subproject title</button></div><input id={`${id}-${index}`} value={subproject.omitTitle ? "" : subproject.name} placeholder={subproject.omitTitle ? "" : "e.g. Deployment automation"} onChange={event => update(index, { name: event.target.value, omitTitle: !event.target.value.trim() })} /></div>
      <label className="profile-field"><span>Details / What I did</span><textarea className="profile-details" rows={8} value={profileDetails(subproject)} placeholder="Describe your work freely: tasks, architecture, technologies, challenges, results, and metrics. AI will select and write the resume bullets for each job." onChange={event => update(index, { details: event.target.value })} /></label>
    </section>)}
    <AddButton onClick={() => onChange([...subprojects, { name: "", details: "" }])}>Add subproject</AddButton>
  </div>;
}

type Experience = ResumeProfileUpdate["workExperiences"][number] | ResumeProfileUpdate["researchExperiences"][number];

function ExperienceCard({ value, index, research, onChange, onRemove }: {
  value: Experience; index: number; research: boolean; onChange: (patch: Partial<Experience>) => void; onRemove: () => void;
}) {
  const organization = "company" in value ? value.company : value.organization;
  const kind = research ? "Research" : "Work";
  return <article className="profile-entry-card" aria-label={`${kind} entry ${index + 1}`}>
    <div className="profile-entry-heading"><span>{kind} {index + 1}</span><RemoveButton label={`Remove ${kind.toLowerCase()}`} onClick={onRemove} /></div>
    <div className="profile-fields profile-fields-two">
      <label className="profile-field"><span>{research ? "Organization" : "Company"}</span><input value={organization} placeholder={research ? "University or research organization" : "Company name"} onChange={event => onChange(research ? { organization: event.target.value } : { company: event.target.value })} /></label>
      <label className="profile-field"><span>Actual job title</span><input value={value.title} placeholder={research ? "e.g. Undergraduate Researcher" : "e.g. Software Developer Intern"} onChange={event => onChange({ title: event.target.value })} /></label>
    </div>
    <div className="profile-fields profile-dates">
      <label className="profile-field"><span>Location</span><input value={value.location} placeholder="City, region / Remote" onChange={event => onChange({ location: event.target.value })} /></label>
      <label className="profile-field"><span>Start</span><input value={value.startDate} placeholder="May 2026" onChange={event => onChange({ startDate: event.target.value })} /></label>
      <label className="profile-field"><span>End</span><input value={value.endDate} placeholder="Aug. 2026" disabled={value.isCurrent} onChange={event => onChange({ endDate: event.target.value })} /></label>
      <label className="profile-current"><input type="checkbox" checked={value.isCurrent} onChange={event => onChange({ isCurrent: event.target.checked, ...(event.target.checked ? { endDate: "Present" } : {}) })} /><span>Current</span></label>
    </div>
    <SubprojectsEditor subprojects={value.subprojects} onChange={subprojects => onChange({ subprojects })} />
    <details className="profile-ai-guidance">
      <summary>AI guidance</summary>
      <div>
        <label className="profile-guidance-toggle"><input type="checkbox" checked={!!value.aiGuidance?.onlyIfStronglyRelevant} onChange={event => onChange({ aiGuidance: { ...value.aiGuidance, onlyIfStronglyRelevant: event.target.checked } })} /><span>Only include if strongly relevant</span></label>
        <label className="profile-field"><span>Optional instruction</span><input value={value.aiGuidance?.instruction || ""} maxLength={300} placeholder="e.g. Use at most 2 bullets; emphasize infrastructure" onChange={event => onChange({ aiGuidance: { ...value.aiGuidance, instruction: event.target.value } })} /></label>
      </div>
    </details>
  </article>;
}

export function ProfileEditor({ value, onChange }: { value: ResumeProfileUpdate; onChange: (value: ResumeProfileUpdate) => void }) {
  const update = <K extends keyof ResumeProfileUpdate>(key: K, next: ResumeProfileUpdate[K]) => onChange({ ...value, [key]: next });
  const edit = (updater: (draft: ResumeProfileUpdate) => void) => { const draft = structuredClone(value); updater(draft); onChange(draft); };
  return <div className="profile-editor">
    <Section title="Personal information" description="Contact details and links for your resume header.">
      <div className="profile-fields">
        <label className="profile-field"><span>First name</span><input autoComplete="given-name" value={value.firstName} onChange={event => update("firstName", event.target.value)} /></label>
        <label className="profile-field"><span>Last name</span><input autoComplete="family-name" value={value.lastName} onChange={event => update("lastName", event.target.value)} /></label>
        <label className="profile-field"><span>Email</span><input type="email" autoComplete="email" value={value.email} onChange={event => update("email", event.target.value)} /></label>
        <label className="profile-field"><span>Phone</span><input type="tel" autoComplete="tel" value={value.phone} onChange={event => update("phone", event.target.value)} /></label>
        <label className="profile-field profile-span-two"><span>Location / relocation</span><input value={value.location} onChange={event => update("location", event.target.value)} /></label>
        <label className="profile-field"><span>LinkedIn</span><input value={value.linkedin} onChange={event => update("linkedin", event.target.value)} /></label>
        <label className="profile-field"><span>GitHub</span><input value={value.github} onChange={event => update("github", event.target.value)} /></label>
        <label className="profile-field"><span>Website</span><input value={value.website} onChange={event => update("website", event.target.value)} /></label>
      </div>
    </Section>
    <Section title="Education" description="Your institutions, degrees, and graduation dates." action={<AddButton onClick={() => edit(draft => { draft.education.push({ institution: "", degree: "", location: "", startDate: "", endDate: "" }); })}>Add education</AddButton>}>
      {value.education.map((education, index) => <article className="profile-entry-card" key={index} aria-label={`Education entry ${index + 1}`}>
        <div className="profile-entry-heading"><span>Education {index + 1}</span><RemoveButton label="Remove education" onClick={() => edit(draft => { draft.education.splice(index, 1); })} /></div>
        <div className="profile-fields profile-fields-two">
          <label className="profile-field"><span>Institution</span><input value={education.institution} onChange={event => edit(draft => { draft.education[index].institution = event.target.value; })} /></label>
          <label className="profile-field"><span>Degree</span><input value={education.degree} onChange={event => edit(draft => { draft.education[index].degree = event.target.value; })} /></label>
        </div>
        <div className="profile-fields">
          <label className="profile-field"><span>Location</span><input value={education.location} onChange={event => edit(draft => { draft.education[index].location = event.target.value; })} /></label>
          <label className="profile-field"><span>Start</span><input value={education.startDate} placeholder="Sep. 2024" onChange={event => edit(draft => { draft.education[index].startDate = event.target.value; })} /></label>
          <label className="profile-field"><span>End / expected</span><input value={education.endDate} placeholder="Expected May 2029" onChange={event => edit(draft => { draft.education[index].endDate = event.target.value; })} /></label>
        </div>
      </article>)}
      {!value.education.length && <p className="profile-empty">Add an institution to get started.</p>}
    </Section>
    <Section title="Work Experience" description="Keep your actual title, then group your contributions into named subprojects." action={<AddButton onClick={() => edit(draft => { draft.workExperiences.push({ company: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, subprojects: [{ name: "", details: "" }] }); })}>Add work</AddButton>}>
      {value.workExperiences.map((experience, index) => <ExperienceCard key={index} value={experience} index={index} research={false} onChange={patch => edit(draft => { Object.assign(draft.workExperiences[index], patch); })} onRemove={() => edit(draft => { draft.workExperiences.splice(index, 1); })} />)}
      {!value.workExperiences.length && <p className="profile-empty">Add a role, then describe the work you contributed.</p>}
    </Section>
    <Section title="Research Experience" description="Add your research roles and the projects you contributed to." action={<AddButton onClick={() => edit(draft => { draft.researchExperiences.push({ organization: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, subprojects: [{ name: "", details: "" }] }); })}>Add research</AddButton>}>
      {value.researchExperiences.map((experience, index) => <ExperienceCard key={index} value={experience} index={index} research onChange={patch => edit(draft => { Object.assign(draft.researchExperiences[index], patch); })} onRemove={() => edit(draft => { draft.researchExperiences.splice(index, 1); })} />)}
      {!value.researchExperiences.length && <p className="profile-empty">Add a research role and its named subprojects.</p>}
    </Section>
    <Section title="Standalone Projects" description="Optional. Include independent projects worth considering for a tailored resume." action={<AddButton onClick={() => edit(draft => { draft.projects.push({ name: "", technologies: [], dates: "", details: "" }); })}>Add project</AddButton>}>
      {value.projects.map((project, index) => <article className="profile-entry-card" key={index} aria-label={`Project entry ${index + 1}`}>
        <div className="profile-entry-heading"><span>Project {index + 1}</span><RemoveButton label="Remove project" onClick={() => edit(draft => { draft.projects.splice(index, 1); })} /></div>
        <div className="profile-fields profile-fields-two">
          <label className="profile-field"><span>Project name</span><input value={project.name} onChange={event => edit(draft => { draft.projects[index].name = event.target.value; })} /></label>
          <label className="profile-field"><span>Dates</span><input value={project.dates} placeholder="Jan. 2026 - Present" onChange={event => edit(draft => { draft.projects[index].dates = event.target.value; })} /></label>
        </div>
        <ListField label="Technologies" value={project.technologies} placeholder="e.g. Rust, PostgreSQL, Docker" onChange={technologies => edit(draft => { draft.projects[index].technologies = technologies; })} />
        <label className="profile-field"><span>Details / What I did</span><textarea className="profile-details" rows={8} value={profileDetails(project)} placeholder="Raw notes about what you built, how it works, and its impact." onChange={event => edit(draft => { draft.projects[index].details = event.target.value; })} /></label>
      </article>)}
      {!value.projects.length && <p className="profile-empty">No standalone projects added.</p>}
    </Section>
    <Section title="Technical Skills" description="Your master inventory is a starting pool, not a whitelist. AI selects relevant skills and may supplement them from the JD; review the result before applying.">
      <label className="profile-field"><span>Master skill inventory</span><textarea className="profile-details" rows={8} value={masterSkills(value)} placeholder="Languages, frameworks, tools, platforms, and engineering concepts you know. Use commas or new lines." onChange={event => update("skillInventory", event.target.value)} /></label>
    </Section>
  </div>;
}
