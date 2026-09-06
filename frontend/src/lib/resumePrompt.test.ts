import { expect, it } from "vitest";
import prompt from "../skills/resume-generation.md?raw";

it("uses general JD-first judgment without anchoring on sample companies or stacks", () => {
  expect(prompt).toContain("check coverage of the JD's central languages");
  expect(prompt).toContain("core requirements from optional or incidental keywords");
  expect(prompt).toContain("do not assume a universal stack");
  expect(prompt).toContain("omitTitle=true");
  expect(prompt).toContain("do not contradict the source");
  expect(prompt).not.toMatch(/Ericsson|British Columbia|TypeScript|limma|LangChain|30%|1M events/);
  expect(prompt).not.toContain("Required JSON shape");
});
