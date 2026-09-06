import type { ResumeProfile, StructuredResume } from "../types";

// Preserve intentional omissions even when a provider invents a heading.
export function preserveSubprojectTitles(resume: StructuredResume, profile: ResumeProfile): StructuredResume {
  return { ...resume, experience: resume.experience.map(entry => {
    const sources = entry.type === "work"
      ? profile.workExperiences.map(role => ({ ...role, organization: role.company }))
      : profile.researchExperiences;
    const role = sources.find(role => role.organization.trim() === entry.organization.trim() && role.title.trim() === entry.title.trim());
    if (!role || !role.subprojects.some(sub => sub.omitTitle || !sub.name.trim())) return entry;
    const titles = new Set(role.subprojects.filter(sub => !sub.omitTitle && sub.name.trim()).map(sub => sub.name));
    return { ...entry, subprojects: entry.subprojects?.map(sub => ({ ...sub, name: titles.has(sub.name) ? sub.name : "" })) };
  }) };
}
