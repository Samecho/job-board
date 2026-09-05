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

const profile = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+1 416 555 0100",
  location: "Toronto, ON",
  linkedin: "https://linkedin.com/in/ada",
  github: "https://github.com/ada",
  website: "https://ada.example.com",
  education_text: "BASc Computer Engineering, University of Toronto, 2024-2028",
  experience_text: "Software Engineer Intern: built Go services and Kubernetes deployments.",
  projects_text: "Rust vector search engine using HNSW.",
  research_text: "Undergraduate Researcher: distributed systems experiments across 80 nodes.",
  skills_text: "Go, Rust, Python, Docker, Kubernetes, Terraform",
  awards_text: "",
  other_text: "",
};

describe("resume version persistence", () => {
  beforeEach(async () => {
    await deleteDatabase();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ output_text: JSON.stringify(completeResume) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await deleteDatabase();
  });

  it("creates immutable v1/v2 records, exports PDF plus TeX, and deletes only one version", async () => {
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-sol", api_key: "browser-local-test-key" });
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
});