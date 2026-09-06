import type { ResumeProfile, StructuredResume } from "../types";

export function masterSkills(profile: Pick<ResumeProfile, "skillInventory" | "skills" | "skills_text">): string {
  if (typeof profile.skillInventory === "string") return profile.skillInventory;
  const existing = Object.values(profile.skills || {}).flat();
  return [...new Set(existing)].join(", ") + (profile.skills_text?.trim() ? `${existing.length ? "\n" : ""}${profile.skills_text}` : "");
}

export function skillCategories(skills: StructuredResume["technicalSkills"]): Array<{ name: string; skills: string[] }> {
  if ("categories" in skills) return skills.categories;
  return [
    { name: "Languages", skills: skills.languages },
    { name: "Frameworks", skills: skills.frameworks },
    { name: "Developer Tools", skills: skills.developerTools },
    { name: "Libraries", skills: skills.libraries },
  ];
}
