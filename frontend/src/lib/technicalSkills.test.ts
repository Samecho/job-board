import { expect, it } from "vitest";
import { masterSkills, skillCategories } from "./technicalSkills";
import { completeResume } from "../test/resumeFixtures";
import { normalizeStoredStructuredResume, parseStructuredResumeJson, trimLowestPriorityContent } from "./resumeSchema";
import { renderResumeLatex } from "./resumeLatex";
import prompt from "../skills/resume-generation.md?raw";

it("preserves the complete master inventory and intentional clearing", () => {
  const profile = { skills: { languages: ["Python", "C++"], frameworks: ["React"], developerTools: ["Docker"], libraries: ["limma"] }, skills_text: "Additional legacy knowledge" };
  expect(masterSkills(profile)).toBe("Python, C++, React, Docker, limma\nAdditional legacy knowledge");
  expect(masterSkills({ ...profile, skillInventory: "" })).toBe("");
  expect(masterSkills({ ...profile, skillInventory: "New\nraw inventory" })).toBe("New\nraw inventory");
});

const dynamicResume = { ...completeResume, technicalSkills: { categories: [
  { name: "Languages", skills: ["C", "C++", "PHP"] },
  { name: "Engineering", skills: ["REST APIs", "Object-Oriented Design"] },
  { name: "Tools & Systems", skills: ["Redis", "Linux", "Docker"] },
] } };

it("validates, restores, and renders dynamic categories without fixed headings", () => {
  const parsed = parseStructuredResumeJson(JSON.stringify(dynamicResume));
  expect(normalizeStoredStructuredResume(parsed)).toEqual(parsed);
  const tex = renderResumeLatex(parsed);
  expect(tex).toContain("\\textbf{Tools \\& Systems}");
  expect(tex).toContain("REST APIs, Object-Oriented Design");
  expect(tex).not.toContain("\\textbf{Libraries}");
  expect(tex).not.toContain("limma");
  expect(skillCategories(completeResume.technicalSkills)).toHaveLength(4);
});

it("rejects empty, duplicate, or excessive categories", () => {
  for (const categories of [[], Array(6).fill(dynamicResume.technicalSkills.categories[0]), [
    ...dynamicResume.technicalSkills.categories.slice(0, 2), { name: "Languages", skills: ["SQL"] },
  ], dynamicResume.technicalSkills.categories.map(group => ({ ...group, skills: [] }))]) {
    expect(() => parseStructuredResumeJson(JSON.stringify({ ...dynamicResume, technicalSkills: { categories } }))).toThrow();
  }
});

it("retains valid nonempty categories during one-page trimming", () => {
  let resume = parseStructuredResumeJson(JSON.stringify(dynamicResume));
  for (let i = 0; i < 100; i++) {
    const next = trimLowestPriorityContent(resume);
    if (!next) break;
    resume = next;
    expect(skillCategories(resume.technicalSkills)).toHaveLength(3);
    expect(skillCategories(resume.technicalSkills).every(group => group.skills.length)).toBe(true);
  }
});

it("allows JD-only skills without manufacturing experience claims", () => {
  expect(prompt).toContain("not an exhaustive whitelist");
  expect(prompt).toContain("even when absent from the profile");
  expect(prompt).toContain("only to the skills list");
  expect(prompt).toContain("3-5 concise, nonempty categories");
  expect(prompt).toContain("15-25 useful skills");
});
