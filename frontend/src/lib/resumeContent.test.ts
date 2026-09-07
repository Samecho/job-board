import { expect, it } from "vitest";
import type { ResumeProfileUpdate } from "../types";
import { assembleResume, formatProfileDates, resumeContentSource, resumeContentSchema, RESUME_CONTENT_SCHEMA } from "./resumeContent";
import { renderResumeLatex } from "./resumeLatex";

const profile: ResumeProfileUpdate = {
  firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "1234567890",
  location: "", linkedin: "https://linkedin.com/in/ada", github: "https://github.com/ada", website: "",
  education: [{ institution: "Example University", degree: "BSc, CS & Statistics", location: "Vancouver, BC", startDate: "2024", endDate: "Expected 2029" }],
  workExperiences: [{ company: "Example Systems", title: "Automation Co-op", location: "Ottawa, ON", startDate: "May 2026", endDate: "Expected April 2027", isCurrent: false,
    subprojects: [{ name: "Original title", details: "Built a service." }, { name: "", omitTitle: true, details: "Tested the service." }] }],
  researchExperiences: [{ organization: "Example University", title: "Research Assistant", location: "Remote", startDate: "June 2026", endDate: "", isCurrent: true,
    subprojects: [{ name: "", omitTitle: true, details: "Evaluated models." }] }],
  projects: [{ name: "Search Engine", dates: "2025", technologies: ["Rust"], details: "Built search." }],
  skills: { languages: [], frameworks: [], developerTools: [], libraries: [] }, skillInventory: "Python, Rust",
};
const bullet = { text: "Built a Python service.", highlights: ["Python"] };
it("constrains generated IDs to their profile role and forbids nonexistent projects", () => {
  const schema = JSON.parse(JSON.stringify(resumeContentSchema(profile)));
  const branches = schema.properties.experience.items.anyOf;
  expect(branches.map((branch: { properties: { sourceId: { enum: string[] } } }) => branch.properties.sourceId.enum)).toEqual([["work:0"], ["research:0"]]);
  const workSubs = branches[0].properties.subprojects.items.anyOf;
  expect(workSubs.map((branch: { properties: { sourceId: { enum: string[] } } }) => branch.properties.sourceId.enum)).toEqual([["work:0/sub:0"], ["work:0/sub:1"]]);
  expect(workSubs[1].properties.name.enum).toEqual([""]);
  expect(branches[1].properties.subprojects.items.properties.sourceId.enum).toEqual(["research:0/sub:0"]);
  const empty = JSON.parse(JSON.stringify(resumeContentSchema({ ...profile, projects: [] })));
  expect(empty.properties.projects.maxItems).toBe(0);
  expect(JSON.stringify(empty)).not.toContain("project:0");
});
const content = {
  experience: [
    { sourceId: "research:0", subprojects: [{ sourceId: "research:0/sub:0", name: "Should be hidden", bullets: [bullet] }] },
    { sourceId: "work:0", subprojects: [
      { sourceId: "work:0/sub:1", name: "Also hidden", bullets: [bullet] },
      { sourceId: "work:0/sub:0", name: "Backend Services", bullets: [bullet] },
    ] },
  ],
  projects: [{ sourceId: "project:0", technologies: ["Rust"], bullets: [bullet] }],
  technicalSkills: { categories: [{ name: "Languages", skills: ["Python"] }, { name: "Tools", skills: ["Git"] }, { name: "Systems", skills: ["Linux"] }] },
};
it("assembles fixed facts locally despite reordered roles and subprojects", () => {
  const resume = assembleResume(JSON.stringify(content), profile);
  expect(resume.header.name).toBe("Ada Lovelace");
  expect(resume.header.phone).toBe(profile.phone);
  expect(resume.header.location).toBe("");
  expect(resume.education[0]).toMatchObject({ institution: "Example University", degree: "BSc, CS & Statistics", dates: "2024 -- Expected 2029", details: [] });
  expect(resume.experience[0]).toMatchObject({ organization: "Example University", title: "Research Assistant", location: "Remote", dates: "June 2026 -- Present" });
  expect(resume.experience[1].dates).toBe("May 2026 -- Expected April 2027");
  expect(resume.experience[1].subprojects!.map(sub => sub.name)).toEqual(["", "Backend Services"]);
  expect(resume.projects[0]).toMatchObject({ name: "Search Engine", dates: "2025" });
  const tex = renderResumeLatex(resume);
  expect(tex).toContain("CS \\& Statistics");
  expect(tex).not.toContain("Should be hidden");
  expect(profile.workExperiences[0].subprojects[0].name).toBe("Original title");
});
it("rejects invented, duplicated, and cross-role references and identity fields", () => {
  for (const sourceId of ["work:999", "research:0"]) {
    const invalid = structuredClone(content);
    invalid.experience[1].sourceId = sourceId;
    expect(() => assembleResume(JSON.stringify(invalid), profile)).toThrow();
  }
  const crossed = structuredClone(content);
  crossed.experience[1].subprojects[0].sourceId = "research:0/sub:0";
  expect(() => assembleResume(JSON.stringify(crossed), profile)).toThrow();
  expect(() => assembleResume(JSON.stringify({ ...content, header: {} }), profile)).toThrow();
});
it("normalizes whitespace only and reports unknown IDs without guessing a match", () => {
  const spaced = structuredClone(content);
  spaced.experience[0].sourceId = " research:0 ";
  expect(assembleResume(JSON.stringify(spaced), profile).experience[0].organization).toBe("Example University");
  spaced.experience[0].sourceId = "research:99";
  expect(() => assembleResume(JSON.stringify(spaced), profile)).toThrow("Unknown resume source reference: research:99. Expected one of: work:0, research:0");
});
it("formats partial dates without inventing values and excludes contact/date fields from AI input", () => {
  expect(formatProfileDates("", "")).toBe("");
  expect(formatProfileDates("", "Expected 2029")).toBe("Expected 2029");
  expect(formatProfileDates("2026", "2030", true)).toBe("2026 -- Present");
  const input = JSON.stringify(resumeContentSource(profile));
  expect(input).not.toContain(profile.email);
  expect(input).not.toContain(profile.phone);
  expect(input).not.toContain("Expected April 2027");
  expect(RESUME_CONTENT_SCHEMA.properties).not.toHaveProperty("education");
  expect(RESUME_CONTENT_SCHEMA.properties).not.toHaveProperty("header");
});
