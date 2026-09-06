import { describe, expect, it } from "vitest";
import { completeResume } from "../test/resumeFixtures";
import { normalizeStoredStructuredResume, parseStructuredResumeJson, trimLowestPriorityContent } from "./resumeSchema";
describe("structured resume schema", () => {
  it("accepts the exact content-only schema with work and research", () => {
    expect(parseStructuredResumeJson(JSON.stringify(completeResume))).toEqual(completeResume);
  });

  it("rejects markdown, warnings, unknown keys, and incomplete experience types", () => {
    expect(() => parseStructuredResumeJson(`\`\`\`json\n${JSON.stringify(completeResume)}\n\`\`\``)).toThrow("strict JSON");
    expect(() => parseStructuredResumeJson(JSON.stringify({ ...completeResume, warning: "USER CONFIRMATION NEEDED" }))).toThrow("unexpected warning");
    expect(() => parseStructuredResumeJson(JSON.stringify({ ...completeResume, experience: completeResume.experience.filter(item => item.type === "work") }))).toThrow("both work and research");
  });

  it("normalizes legacy saved resumes without discarding their content", () => {
    const normalized = normalizeStoredStructuredResume({
      header: { name: "Legacy Candidate", email: "legacy@example.com" },
      education: [{ title: "UBC", subtitle: "BSc Computer Science", bullets: ["Dean's List"] }],
      experience: [{ title: "UBC Lab", subtitle: "Research Assistant", bullets: ["Ran experiments"] }],
      projects: [{ title: "Compiler", subtitle: "Rust, LLVM", bullets: ["Built a parser"] }],
      skills: ["Languages: Rust, Python", "Developer Tools: Git, Linux"],
      confirmation_needed: ["This legacy warning is intentionally ignored"],
    });
    expect(normalized.experience[0].type).toBe("research");
    expect(normalized.projects[0].technologies).toEqual(["Rust", "LLVM"]);
    expect("languages" in normalized.technicalSkills && normalized.technicalSkills.languages).toEqual(["Rust", "Python"]);
  });

  it("trims from lower-priority array tails while preserving both experience types", () => {
    let current = completeResume;
    for (let step = 0; step < 30; step += 1) {
      const trimmed = trimLowestPriorityContent(current);
      if (!trimmed) break;
      current = trimmed;
    }
    expect(current.experience.some(item => item.type === "work")).toBe(true);
    expect(current.experience.some(item => item.type === "research")).toBe(true);
    expect(current.experience.every(item => {
      const count = item.subprojects ? item.subprojects.flatMap(s => s.bullets).length : ((item as unknown as { bullets?: string[] }).bullets?.length || 0);
      return count >= 1;
    })).toBe(true);
    expect(current.education.length).toBeGreaterThanOrEqual(1);
  });
});
