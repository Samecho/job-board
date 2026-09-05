import { describe, expect, it } from "vitest";
import { completeResume } from "../test/resumeFixtures";
import { escapeLatex, inspectPdf, normalizeResumeText, renderResumeLatex } from "./resumeLatex";

describe("fixed LaTeX renderer", () => {
  it("uses the locked section order and keeps work and research together", () => {
    const tex = renderResumeLatex(completeResume);
    const education = tex.indexOf("\\section{Education}");
    const experience = tex.indexOf("\\section{Experience}");
    const projects = tex.indexOf("\\section{Projects}");
    const skills = tex.indexOf("\\section{Technical Skills}");
    expect(education).toBeGreaterThan(0);
    expect(experience).toBeGreaterThan(education);
    expect(projects).toBeGreaterThan(experience);
    expect(skills).toBeGreaterThan(projects);
    expect(tex).toContain("Software Engineer Intern");
    expect(tex).toContain("Undergraduate Researcher");
    expect(tex).not.toContain("\\section{Research Experience}");
    expect(tex).not.toContain("USER CONFIRMATION NEEDED");
  });

  it("omits the complete Projects section when projects are empty", () => {
    const tex = renderResumeLatex({ ...completeResume, projects: [] });
    expect(tex).not.toContain("\\section{Projects}");
    expect(tex).toContain("\\section{Technical Skills}");
  });

  it("escapes LaTeX content without turning URLs into resume text", () => {
    expect(escapeLatex("R&D_50% costs $5 #1 {x} ~ ^ \\")).toBe(String.raw`R\&D{\ttfamily\char95}50\% costs {\char36}5 \#1 \{x\} {\ttfamily\char126} {\ttfamily\char94} $\backslash$`);
    const tex = renderResumeLatex(completeResume);
    expect(tex).toContain(String.raw`https://linkedin.com/in/ada\_lovelace`);
    expect(tex).toContain(String.raw`path?a=1\&b=2`);
    expect(tex).toContain("\\pdfgentounicode=1");
  });

  it("normalizes smart punctuation and known mojibake", () => {
    expect(normalizeResumeText("Engineer\u2019s result \u2014 fast")).toBe("Engineer's result --- fast");
    expect(normalizeResumeText("Engineer\u00e2\u20ac\u2122s result")).toBe("Engineer's result");
  });

  it("escapes extended Unicode math symbols without TS1", () => {
    const input = "Improved numerical agreement to 1.2\u00d710\u221216 while preserving R&D_50%, \u00b1 tolerance, and x \u2264 y \u2265 z.";
    expect(escapeLatex(input)).toBe(String.raw`Improved numerical agreement to 1.2$\times$10$-$16 while preserving R\&D{\ttfamily\char95}50\%, $\pm$ tolerance, and x $\leq$ y $\geq$ z.`);
    expect(escapeLatex("\u201cquote\u201d \u2018single\u2019 \u2013 \u2014 \u00a0 \u2022")).toBe(String.raw`"quote" 'single' -- --- -`);
  });

  it("detects page count, US Letter size, and PDF links", () => {
    const bytes = new TextEncoder().encode("/Type /Pages /Count 1 /Type /Page /MediaBox [0 0 612 792] /Subtype /Link /URI (https://example.com)");
    expect(inspectPdf(bytes)).toEqual({ pageCount: 1, isUsLetter: true, hasLinks: true });
  });
});