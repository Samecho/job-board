import { expect, it } from "vitest";
import { completeResume } from "../test/resumeFixtures";
import { renderResumeLatex } from "./resumeLatex";
import { parseStructuredResumeJson } from "./resumeSchema";
import { preserveSubprojectTitles } from "./subprojectTitles";
import type { ResumeProfile } from "../types";

it("accepts omitted work and research headings and emits no heading or blank line", () => {
  const resume = structuredClone(completeResume);
  for (const entry of resume.experience) for (const sub of entry.subprojects || []) sub.name = "";
  const parsed = parseStructuredResumeJson(JSON.stringify(resume));
  const tex = renderResumeLatex(parsed);
  expect(tex).not.toContain("\\resumeSubproject{");
  for (const entry of resume.experience) {
    expect(tex).toContain(`{${entry.location}}\n  \\resumeItemListStart`);
  }
  const whitespace = structuredClone(resume);
  for (const entry of whitespace.experience) for (const sub of entry.subprojects || []) sub.name = "   ";
  expect(renderResumeLatex(whitespace)).toBe(tex);
});

it("allows rewritten titles in mixed roles instead of matching them to fixed source text", () => {
  const resume = structuredClone(completeResume);
  const work = resume.experience.find(entry => entry.type === "work")!;
  const profile = {
    workExperiences: [{ company: work.organization, title: work.title, subprojects: [
      { name: "", omitTitle: true }, { name: work.subprojects![1].name },
    ] }], researchExperiences: [],
  } as unknown as ResumeProfile;
  const result = preserveSubprojectTitles(resume, profile);
  expect(result.experience[0].subprojects![0].name).toBe(work.subprojects![0].name);
  expect(result.experience[0].subprojects![1]).toEqual(work.subprojects![1]);
  expect(result.experience[0].subprojects![0].bullets).toEqual(work.subprojects![0].bullets);
});

it("enforces omission for explicitly untitled roles", () => {
  const resume = structuredClone(completeResume);
  const work = resume.experience[0];
  const profile = { workExperiences: [{ company: work.organization, title: work.title,
    subprojects: [{ name: "", omitTitle: true }] }], researchExperiences: [] } as unknown as ResumeProfile;
  expect(preserveSubprojectTitles(resume, profile).experience[0].subprojects?.every(sub => sub.name === "")).toBe(true);
});
