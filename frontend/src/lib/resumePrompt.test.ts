import { expect, it } from "vitest";
import prompt from "../skills/resume-generation.md?raw";

it("allows bounded JD adaptation consistently across all project contexts", () => {
  expect(prompt).toContain("rewrite descriptive names");
  expect(prompt).toContain("work Experience, Research, and standalone Projects");
  expect(prompt).toContain("implementation-level details may be inferred");
  expect(prompt).toContain("Do not contradict explicit technologies");
  expect(prompt).toContain("Do not invent an employer, project, research result");
  expect(prompt).toContain("omitTitle=true");
  expect(prompt).not.toContain("Preserve supplied names exactly");
});
