import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, databaseRequest, databaseTransaction } from "./client";
import { executeConsoleCommand, parseConsoleCommand } from "./console";
import { readStoreZip, makeZip } from "../lib/resumeFiles";

const run = (command: unknown, files: File[] = [], preview = false) => executeConsoleCommand(JSON.stringify(command), files, preview);
const batch = (operations: unknown[], request_id = "test-1") => ({ action: "batch", request_id, operations });
const create = (requisition_id = "SWE-123", company_id = 1) => ({ action: "create_application", company_id, data: { requisition_id, job_title: "SWE intern", job_description: "Complete original JD" } });
const update = (id: number, changes: unknown) => ({ action: "update_application", id, changes });
const query = (entity = "applications", extra = {}) => run({ action: "query", entity, ...extra });
const pdf = () => new File(["%PDF-1.4\noriginal PDF bytes\n%%EOF"], "Test_Resume.pdf", { type: "application/pdf" });
const upload = (application_ids?: number[], company_id = 1) => ({ action: "import_resume", company_id, file: "Test_Resume.pdf", ...(application_ids ? { application_ids } : {}) });
const oldApp = (company_id = 1) => api.createApplication({ company_id, job_title: "Existing role", job_description: "Preserve original JD", notes: "Preserve submission proof" });
const readStore = (name: string) => databaseTransaction([name], "readonly", (_, tx) => databaseRequest(tx.objectStore(name).getAll()));

async function deleteDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("internradar-browser");
    request.onsuccess = () => resolve();
    request.onerror = request.onblocked = () => reject(request.error || new Error("Database blocked"));
  });
}

beforeEach(async () => { await deleteDatabase(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Console must not use the network"); })); });
afterEach(async () => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); await deleteDatabase(); });

describe("JSON Console validation and queries", () => {
  it.each([
    "alert(1)", "[]", "null", '{"action":"delete"}',
    JSON.stringify({ action: "query", entity: "ai_settings" }),
    JSON.stringify({ action: "query", entity: "applications", limit: 201 }),
    JSON.stringify({ action: "query", entity: "applications", limit: 0 }),
    JSON.stringify({ action: "query", entity: "history", stage: "OA" }),
    JSON.stringify(batch([update(1, { application_stage: "Maybe" })])),
    JSON.stringify(batch([update(1, { company_id: 2 })])),
    JSON.stringify(batch([update(1, { job_url: "javascript:alert(1)" })])),
    JSON.stringify(batch([{ action: "assign_resume", resume_id: 1, application_ids: [1, 1] }])),
    JSON.stringify(batch([{ ...update(1, { notes: "x" }), job: { company_id: 1, requisition_id: "x" } }])),
    JSON.stringify(batch([create()], " ")),
  ])("rejects invalid or unsupported commands: %s", source => expect(() => parseConsoleCommand(source)).toThrow());

  it("queries IDs, companies, JD, stages and pagination without exposing settings or changing records", async () => {
    const a = await oldApp(); await oldApp(); await oldApp(2);
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", api_key: "secret-local-key" });
    const before = await readStore("applications");
    const response = await query("applications", { company_id: 1, limit: 1, offset: 1 });
    expect(response.total).toBe(2); expect(response.items).toHaveLength(1);
    expect(JSON.stringify(response)).not.toContain("Preserve original JD");
    expect((await query("applications", { ids: [a.id], include_jd: true })).items).toMatchObject([{ id: a.id, job_description: a.job_description }]);
    expect((await query("applications", { stage: "Rejected" })).total).toBe(0);
    expect((await query("companies", { ids: [1] })).items).toMatchObject([{ id: 1, application_count: 2 }]);
    expect(JSON.stringify(await query("history"))).not.toContain("secret-local-key");
    expect(await readStore("applications")).toEqual(before);
  });
});

describe("atomic application changes", () => {
  it("previews and updates only targeted fields while preserving history and unselected applications", async () => {
    const a = await oldApp(), b = await oldApp();
    await api.updateApplication(a.id, { application_stage: "Interview" });
    const command = batch([update(a.id, { application_stage: "Rejected" })]);
    expect((await run(command, [], true)).mode).toBe("preview");
    expect((await api.applications()).find(app => app.id === a.id)?.application_stage).toBe("Interview");
    expect((await query("history")).total).toBe(0);
    expect((await run(command)).mode).toBe("applied");
    const apps = await api.applications();
    expect(apps.find(app => app.id === a.id)).toMatchObject({ application_stage: "Rejected", stage_history: ["Applied", "Interview", "Rejected"], notes: a.notes, job_description: a.job_description });
    expect(apps.find(app => app.id === b.id)).toEqual(b);
    expect((await api.analytics()).application_flows).toContainEqual({ source: "Interview", target: "Rejected", count: 1 });
  });

  it("does not save any operations or history when a later operation fails", async () => {
    const a = await oldApp();
    await expect(run(batch([update(a.id, { notes: "Wrong" }), create(), update(99999, { application_stage: "OA" })]))).rejects.toThrow("not found");
    expect(await api.applications()).toEqual([a]);
    expect((await query("history")).total).toBe(0);
  });

  it("rolls back even writes already issued if the transaction cannot store its receipt", async () => {
    const a = await oldApp();
    const original = IDBObjectStore.prototype.add;
    const spy = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "console_requests") throw new Error("Simulated storage failure");
      return original.call(this, value, key);
    });
    try { await expect(run(batch([create(), update(a.id, { notes: "Wrong" })]))).rejects.toThrow("storage failure"); }
    finally { spy.mockRestore(); }
    expect(await api.applications()).toEqual([a]);
    expect((await query("history")).total).toBe(0);
  });

  it("creates submitted roles, resolves exact requisitions and makes retries idempotent", async () => {
    const command = batch([create()]);
    const first = await run(command);
    expect(first.mode).toBe("applied");
    expect((await run(command)).mode).toBe("replayed");
    expect(await api.applications()).toHaveLength(1);
    await expect(run(batch([create("different")]))).rejects.toThrow("request_id already used");
    await expect(run(batch([create(" swe-123 ")], "duplicate"))).rejects.toThrow("already exists");
    await run(batch([{ action: "update_application", job: { company_id: 1, requisition_id: "swe-123" }, changes: { application_stage: "OA", assessment_status: "completed", application_email: "test@example.com", assessment_url: "https://example.com/test", submitted_at: "2026-11-14" } }], "status"));
    expect((await api.applications())[0]).toMatchObject({ application_stage: "OA", assessment_status: "completed", job_description: "Complete original JD", application_email: "test@example.com" });
    expect((await query("history")).total).toBe(2);
  });

  it("guards stale edits, legacy duplicates and conflicting requisition IDs", async () => {
    const a = await oldApp();
    await api.updateApplication(a.id, { notes: "Official confirmation: ABC.123" });
    await expect(run(batch([create("ABC.123")]))).rejects.toThrow("legacy duplicate");
    await expect(run(batch([{ ...update(a.id, { notes: "stale" }), expected_updated_at: "wrong" }]))).rejects.toThrow("changed since");
    await run(batch([create("ABC.124")], "create"));
    await expect(run(batch([update(a.id, { requisition_id: "ABC.124" })], "conflict"))).rejects.toThrow("another application");
    expect((await api.applications()).find(app => app.id === a.id)?.notes).toBe("Official confirmation: ABC.123");
  });

  it("includes changed JD content in the preview and preserves cleared optional fields", async () => {
    const a = await oldApp();
    const response = await run(batch([update(a.id, { job_description: "Revised JD", assessment_url: "" })]), [], true);
    expect(response.changes).toMatchObject([{ before: { job_description: a.job_description }, after: { job_description: "Revised JD", assessment_url: "" } }]);
    expect((await api.applications())[0]).toEqual(a);
  });
});

describe("uploaded PDF associations", () => {
  it("preserves PDF bytes, deduplicates uploads, and supports assignment and unassignment", async () => {
    const a = await oldApp(), b = await oldApp();
    const file = pdf(), command = batch([upload([a.id])]);
    expect((await run(command, [file], true)).mode).toBe("preview");
    expect(await api.resumes()).toHaveLength(0);
    await run(command, [file]);
    expect((await run(command, [file])).mode).toBe("replayed");
    const resume = (await api.companyResumes(1))[0];
    expect(resume).toMatchObject({ source: "uploaded", file_name: file.name, structured_resume: null });
    expect(await (await api.getResumeVersion(resume.id))!.pdf_file.text()).toBe(await file.text());
    await expect(api.refineResumeVersion(resume.id, a.id, "{}" )).rejects.toThrow("Uploaded");
    await run(batch([upload([b.id])], "reuse"), [file]);
    expect(await api.resumes()).toHaveLength(1);
    expect((await query("resumes")).items).toMatchObject([{ id: resume.id, assigned_application_ids: [a.id, b.id] }]);
    await run(batch([{ action: "assign_resume", resume_id: null, application_ids: [a.id] }], "unlink"));
    expect((await api.applications()).find(app => app.id === a.id)?.assigned_resume_version_id).toBeNull();
    await run(batch([{ action: "assign_resume", resume_id: resume.id, application_ids: [a.id] }], "relink"));
    expect((await api.applications()).find(app => app.id === a.id)?.assigned_resume_version_id).toBe(resume.id);
  });

  it("rejects missing, invalid, duplicate filenames and cross-company targets without partial saves", async () => {
    const a = await oldApp(), other = await oldApp(2);
    await expect(run(batch([upload([a.id])]))).rejects.toThrow("Select exactly one");
    await expect(run(batch([upload([a.id])]), [pdf(), pdf()])).rejects.toThrow("Select exactly one");
    await expect(run(batch([upload([a.id])]), [new File(["not pdf"], "Test_Resume.pdf")])).rejects.toThrow("not a PDF");
    await expect(run(batch([update(a.id, { notes: "Wrong" }), upload([a.id, other.id])]), [pdf()])).rejects.toThrow("same company");
    expect(await api.resumes()).toHaveLength(0);
    expect((await api.applications()).find(app => app.id === a.id)).toEqual(a);
  });

  it("stores unattached PDFs separately without backup path collisions and restores history and assignments", async () => {
    await api.saveAiSettings({ provider: "openai", model: "gpt-5.6-luna", api_key: "private-key" });
    await run(batch([upload()]), [pdf()]);
    const file2 = new File(["%PDF-1.4\na different version"], "Test_Resume.pdf");
    await run(batch([upload()], "second"), [file2]);
    const a = await oldApp();
    await run(batch([{ action: "assign_resume", resume_id: 1, application_ids: [a.id] }], "assign"));
    const backup = await api.exportBackup(), files = await readStoreZip(backup);
    expect(Object.keys(files).filter(path => path.endsWith(".pdf"))).toHaveLength(2);
    expect(await files["data.json"].text()).not.toContain("private-key");
    await deleteDatabase();
    await api.importBackup(new File([backup], "backup.zip"));
    expect(await api.resumes()).toHaveLength(2);
    expect((await api.applications())[0].assigned_resume_version_id).toBe(1);
    expect((await query("history")).total).toBe(3);
    expect((await run(batch([upload()]), [pdf()])).mode).toBe("replayed");
    expect(await (await api.getResumeVersion(1))!.pdf_file.text()).toBe(await pdf().text());
    expect(await (await api.getResumeVersion(2))!.pdf_file.text()).toBe(await file2.text());
  });
});

describe("backward compatibility", () => {
  it("upgrades a v3 database without rewriting existing rows or PDF bytes", async () => {
    const rows: Record<string, object> = {
      applications: { id: 7, company_id: 1, job_title: "Legacy", job_description: "Keep JD", notes: "Keep notes", application_stage: "Interview", created_at: "old", updated_at: "old" },
      resume_versions: { id: 8, company_id: 1, pdf_file: pdf(), extra_legacy_field: "keep" },
      company_states: { company_id: 1, notes: "Company note", unmatched_stage: "OA" },
      resume_profile: { id: 1, name: "Private name" },
      ai_settings: { id: 1, api_key: "private-key" },
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("internradar-browser", 3);
      request.onupgradeneeded = () => {
        for (const [name, row] of Object.entries(rows)) request.result.createObjectStore(name, { keyPath: name === "company_states" ? "company_id" : "id", autoIncrement: ["applications", "resume_versions"].includes(name) }).put(row);
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    await query();
    for (const name of Object.keys(rows).filter(name => name !== "resume_versions")) expect(await readStore(name)).toEqual([rows[name]]);
    const [resume] = await readStore("resume_versions");
    expect(resume.extra_legacy_field).toBe("keep");
    expect(await resume.pdf_file.text()).toBe(await pdf().text());
    expect((await query("history")).total).toBe(0);
  });

  it("accepts older backups without console history and never clears data on ordinary commands", async () => {
    const a = await oldApp();
    const files = await readStoreZip(await api.exportBackup());
    const data = JSON.parse(await files["data.json"].text()); delete data.console_requests;
    await api.importBackup(new File([await makeZip({ ...files, "data.json": JSON.stringify(data) })], "legacy.zip"));
    await run(batch([update(a.id, { application_stage: "OA" })]));
    expect(await api.applications()).toHaveLength(1);
    expect((await api.applications())[0]).toMatchObject({ id: a.id, notes: a.notes, job_description: a.job_description });
  });
});
