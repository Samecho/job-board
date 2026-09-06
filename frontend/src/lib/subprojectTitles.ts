import type { ResumeProfile, StructuredResume } from "../types";

// For entirely untitled roles, enforce omission without relying on AI title matching.
// Mixed roles follow source-specific omission instructions in the generation prompt.
export function preserveSubprojectTitles(resume: StructuredResume, profile: ResumeProfile): StructuredResume {
  return { ...resume, experience: resume.experience.map(entry => {
    const sources = entry.type === "work"
      ? profile.workExperiences.map(role => ({ ...role, organization: role.company }))
      : profile.researchExperiences;
    const role = sources.find(role => role.organization.trim() === entry.organization.trim() && role.title.trim() === entry.title.trim());
    if (!role?.subprojects.length || !role.subprojects.every(sub => sub.omitTitle)) return entry;
    return { ...entry, subprojects: entry.subprojects?.map(sub => ({ ...sub, name: "" })) };
  }) };
}
