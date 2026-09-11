import { compileResumeLatex } from "../lib/resumeLatex";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeResume } from "../test/resumeFixtures";
import { readStoreZip } from "../lib/resumeFiles";

vi.mock("../lib/resumeLatex", async importOriginal => {
  const actual = await importOriginal<typeof import("../lib/resumeLatex")>();
  return {
    ...actual,
    compileResumeLatex: vi.fn(async () => {
      const pdfBytes = new TextEncoder().encode("%PDF-1.4 /Type /Page /MediaBox [0 0 612 792]");
      return { pdfFile: new Blob([pdfBytes], { type: "application/pdf" }), pdfBytes, pageCount: 1, log: "ok" };
    }),
  };
});

import { api } from "./client";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("internradar-browser");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB deletion was blocked"));
  });
}

const generatedContent = {
  experience: completeResume.experience.map((role, index) => ({
    sourceId: index === 0 ? "work:0" : "research:0",
    subprojects: role.subprojects!.slice(0, 1).map(sub => ({ ...sub, sourceId: index === 0 ? "work:0/sub:0" : "research:0/sub:0" })),
  })),
  projects: completeResume.projects.map(project => ({ sourceId: "project:0", technologies: project.technologies, bullets: project.bullets })),
  technicalSkills: completeResume.technicalSkills,
};
const profile = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+1 416 555 0100",
  location: "Toronto, ON",
  linkedin: "https://linkedin.com/in/ada",
  github: "https://github.com/ada",
  website: "https://ada.example.com",
  education: [{ institution: "University of Toronto", degree: "BASc Computer Engineering", location: "Toronto, ON", startDate: "Sep. 2024", endDate: "Expected May 2028" }],
  workExperiences: [{ company: "Example Cloud", title: "Software Engineer Intern", location: "Toronto, ON", startDate: "May 2026", endDate: "Aug. 2026", isCurrent: false, subprojects: [{ name: "Go Services", bullets: [{ text: "Built Go services", highlights: ["Go"] }] }] }],
  researchExperiences: [{ organization: "Systems Research Lab", title: "Undergraduate Researcher", location: "Toronto, ON", startDate: "Sep. 2025", endDate: "Present", isCurrent: true, subprojects: [{ name: "Distributed Systems", bullets: [{ text: "Designed experiments", highlights: [] }] }] }],
  projects: [{ name: "Vector Search", technologies: ["Rust"], dates: "2026", bullets: [{ text: "Built", highlights: [] }] }],
  skills: { languages: ["Go", "Rust", "Python"], frameworks: ["React"], developerTools: ["Docker", "Kubernetes"], libraries: ["PyTorch"] },
  name: "Ada Lovelace",
  education_text: "",
  experience_text: "",
  projects_text: "",
  research_text: "",
  skills_text: "",
  awards_text: "",
  other_text: "",
};

describe("resume version persistence", () => {
  it("shares one PDF across applications, refines immutably, and restores assignments from backup", async () => {
    await api.updateProfile(profile);
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", api_key: "test-local" });
    const a = await api.createApplication({ company_id: 1, job_title: "Backend", job_description: "Go services", notes: "first" });
    const b = await api.createApplication({ company_id: 2, job_title: "Infra", job_description: "Kubernetes systems", notes: "second" });
    await api.updateApplication(b.id, { application_stage: "Interview" });
    const v1 = await api.generateResumeVersion(a.id, "", [a.id, b.id, b.id]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][1]?.body)).toContain("Kubernetes systems");
    expect(await api.resumes()).toHaveLength(1);
    expect((await api.resumeVersions(b.id))[0].id).toBe(v1.id);
    expect((await api.applications()).every(app => app.assigned_resume_version_id === v1.id)).toBe(true);
    expect((await api.companies()).find(item => item.id === 2)?.resume_count).toBe(1);
    const edited = structuredClone(v1.structured_resume);
    edited.header.location = "Vancouver";
    const v2 = await api.refineResumeVersion(v1.id, a.id, JSON.stringify(edited));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(v2.parent_version_id).toBe(v1.id);
    expect((await api.getResumeVersion(v1.id))?.structured_resume.header.location).not.toBe("Vancouver");
    expect((await api.applications(2))[0].assigned_resume_version_id).toBe(v1.id);
    await api.assignResume(b.id, v2.id);
    const backup = await api.exportBackup();
    await api.importBackup(new File([backup], "backup.zip"));
    expect((await api.applications(2))[0]).toMatchObject({ assigned_resume_version_id: v2.id, notes: "second", application_stage: "Interview" });
    expect((await api.analytics()).total_applications).toBe(2);
    await api.deleteApplication(a.id);
    expect(await api.getResumeVersion(v2.id)).toBeDefined();
    await api.deleteResumeVersion(v2.id);
    expect((await api.applications(2))[0].assigned_resume_version_id).toBeNull();
    expect(await api.getResumeVersion(v1.id)).toBeDefined();
  });

  it("AI refinement calls once and preserves the supplied original; invalid edits cannot save", async () => {
    await api.updateProfile(profile);
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", api_key: "test-local" });
    const app = await api.createApplication({ company_id: 1, job_title: "Backend", job_description: "Go", notes: "" });
    const original = await api.generateResumeVersion(app.id, "");
    const changed = structuredClone(original.structured_resume);
    changed.header.location = "Remote";
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(changed), status: "completed" })));
    const refined = await api.refineResumeVersion(original.id, app.id, JSON.stringify(original.structured_resume), "Change location to Remote only");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refined.structured_resume.experience).toEqual(original.structured_resume.experience);
    expect(refined.structured_resume.header.location).toBe("Remote");
    await expect(api.refineResumeVersion(original.id, app.id, "{}" )).rejects.toThrow();
    expect(await api.resumes()).toHaveLength(2);
    vi.mocked(compileResumeLatex).mockResolvedValueOnce({ pdfFile: new Blob(), pdfBytes: new Uint8Array(), pageCount: 2, log: "" });
    await expect(api.refineResumeVersion(original.id, app.id, JSON.stringify(changed))).rejects.toThrow("one page");
    expect(await api.resumes()).toHaveLength(2);
  });
  beforeEach(async () => {
    await deleteDatabase();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify( { status: "completed", output_text: JSON.stringify(generatedContent), usage: { input_tokens: 3000, output_tokens: 2300, output_tokens_details: { reasoning_tokens: 200 } } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await deleteDatabase();
  });

  it("creates immutable v1/v2 records, exports PDF plus TeX, and deletes only one version", async () => {
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", api_key: "browser-local-test-key" });
    await api.updateProfile(profile);
    const application = await api.createApplication({
      company_id: 1,
      job_title: "Software Engineer Intern",
      job_description: "Build reliable backend services, distributed systems, and Kubernetes infrastructure in Go.",
      notes: "Fall application",
    });

    await api.generateResumeVersion(application.id, "Emphasize infrastructure impact.");
    await api.generateResumeVersion(application.id, "Emphasize distributed systems research.");

    const versions = await api.resumeVersions(application.id);
    expect(versions.map(version => version.version_number)).toEqual([2, 1]);
    const newest = await api.getResumeVersion(versions[0].id);
    expect(newest?.tex_source).toContain("\\documentclass[letterpaper,11pt]{article}");
    expect(newest?.structured_resume.header.phone).toBe(profile.phone);
    expect(newest?.structured_resume.education[0].institution).toBe(profile.education[0].institution);
    expect(newest?.structured_resume.experience[0].organization).toBe(profile.workExperiences[0].company);
    expect(newest?.pdf_file.type).toBe("application/pdf");
    expect(newest && "docx_file" in newest).toBe(false);

    const companies = await api.companies();
    const company = companies.find(item => item.id === 1);
    expect(company?.application_count).toBe(1);
    expect(company?.resume_count).toBe(2);

    const backupFiles = await readStoreZip(await api.exportBackup());
    expect(Object.keys(backupFiles).filter(name => name.endsWith(".pdf"))).toHaveLength(2);
    expect(Object.keys(backupFiles).filter(name => name.endsWith(".tex"))).toHaveLength(2);
    expect(Object.keys(backupFiles).some(name => name.endsWith(".docx"))).toBe(false);

    await api.deleteResumeVersion(versions[0].id);
    expect(await api.applications(1)).toHaveLength(1);
    expect(await api.resumeVersions(application.id)).toHaveLength(1);
  });
  it("migrates all legacy notes, preserves archived bullets, and sends only current details to AI", async () => {
    await api.updateProfile(profile);
    const migrated = await api.profile();
    expect(migrated.workExperiences[0].subprojects[0].details).toBe("Built Go services");
    expect(migrated.workExperiences[0].subprojects[0].bullets).toEqual(profile.workExperiences[0].subprojects[0].bullets);
    const notes = "Messy raw notes: built a queue with Go; measured p99 latency.\n".repeat(100);
    migrated.workExperiences[0].subprojects[0].details = notes;
    await api.updateProfile(migrated);
    expect((await api.profile()).workExperiences[0].subprojects[0].details).toBe(notes);
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", api_key: "test-local" });
    const app = await api.createApplication({ company_id: 1, job_title: "Backend Intern", job_description: "Go queues", notes: "" });
    await api.generateResumeVersion(app.id, "Prioritize reliability");
    const requestBodies = vi.mocked(fetch).mock.calls.map(call => String(call[1]?.body));
    expect(requestBodies[0]).toContain("Messy raw notes");
    expect(requestBodies[0]).not.toContain("Built Go services");
    expect(requestBodies.join("\n")).not.toContain("2-4 bullets");
    expect(requestBodies.every(body => body.includes("Prioritize reliability"))).toBe(true);
  });

  it("retains complete multiline flat profile notes during migration", async () => {
    const legacy = { ...profile, workExperiences: [], researchExperiences: [], projects: [],
      experience_text: "first line\n" + "work source ".repeat(100),
      research_text: "research\nsecond line", projects_text: "project\narchitecture" };
    await api.updateProfile(legacy);
    const migrated = await api.profile();
    expect(migrated.workExperiences[0].subprojects[0].details).toBe(legacy.experience_text);
    expect(migrated.researchExperiences[0].subprojects[0].details).toBe(legacy.research_text);
    expect(migrated.projects[0].details).toBe(legacy.projects_text);
    expect(await api.profile()).toEqual(migrated);
  });
  it("fits overflow locally with only one generation request", async () => {
    await api.updateProfile(profile);
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", reasoning_effort: "low", api_key: "test-local" });
    const app = await api.createApplication({ company_id: 1, job_title: "Backend", job_description: "Go", notes: "" });
    const onePage = { pdfFile: new Blob(["pdf"], { type: "application/pdf" }), pdfBytes: new Uint8Array(), pageCount: 1, log: "ok" };
    vi.mocked(compileResumeLatex).mockResolvedValueOnce({ ...onePage, pageCount: 2 }).mockResolvedValueOnce(onePage);
    await api.generateResumeVersion(app.id, "");
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
    const paid = vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith("/responses"));
    expect(paid).toHaveLength(1);
    const body = JSON.parse(String(paid[0][1]?.body));
    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.reasoning.effort).toBe("low");
    expect(body).not.toHaveProperty("max_output_tokens");
    expect(body.service_tier).toBe("default");
    const roleSchemas = body.text.format.schema.properties.experience.items.anyOf;
    expect(roleSchemas.map((role: { properties: { sourceId: { enum: string[] } } }) => role.properties.sourceId.enum)).toEqual([["work:0"], ["research:0"]]);
    expect(roleSchemas[0].properties.subprojects.items.properties.sourceId.enum).toEqual(["work:0/sub:0"]);
    const versions = await api.resumeVersions(app.id);
    expect(versions[0].ai_usage?.output_tokens).toBe(2300);
    expect(versions[0].reasoning_effort).toBe("low");
  });

  it("generates with the selected expensive model and no budget or output cap", async () => {
    await api.updateProfile(profile);
    await api.saveAiSettings({ provider: "openai", model: "gpt-6-astra", reasoning_effort: "max", api_key: "test-local" });
    const app = await api.createApplication({ company_id: 1, job_title: "Backend", job_description: "Go", notes: "" });
    await api.generateResumeVersion(app.id, "");
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.model).toBe("gpt-6-astra");
    expect(body.reasoning.effort).toBe("max");
    expect(body).not.toHaveProperty("max_output_tokens");
    expect((await api.resumeVersions(app.id))[0].ai_usage?.estimated_usd).toBeGreaterThan(0.05);
  });

  it("reports the provider's incomplete reason and cost without retrying", async () => {
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", api_key: "test-local" });
    const app = await api.createApplication({ company_id: 1, job_title: "Backend", job_description: "Go", notes: "" });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "content_filter" }, usage: { input_tokens: 1000, output_tokens: 4500 } })));
    await expect(api.generateResumeVersion(app.id, "")).rejects.toThrow("content_filter");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await api.resumeVersions(app.id)).toHaveLength(0);
  });
});
