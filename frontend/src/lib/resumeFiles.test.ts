import { describe, expect, it } from "vitest";
import { asPdfBlob, makeZip, readStoreZip } from "./resumeFiles";

describe("PDF blob compatibility", () => {
  it.each(["", "application/octet-stream", "text/plain", "application/pdf"])("preserves bytes and uses PDF MIME for %s", async type => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 53, 0, 255, 42]);
    const source = new Blob([bytes], { type });
    const pdf = asPdfBlob(source);
    expect(pdf.type).toBe("application/pdf");
    expect(new Uint8Array(await pdf.arrayBuffer())).toEqual(bytes);
    expect(source.type).toBe(type);
  });

  it("normalizes PDF bytes extracted from a backup zip without modifying them", async () => {
    const original = new Blob([new Uint8Array([37, 80, 68, 70, 0, 255])], { type: "application/pdf" });
    const extracted = (await readStoreZip(await makeZip({ "resume.pdf": original })))["resume.pdf"];
    expect(extracted.type).toBe("");
    const pdf = asPdfBlob(extracted);
    expect(pdf.type).toBe("application/pdf");
    expect(new Uint8Array(await pdf.arrayBuffer())).toEqual(new Uint8Array(await original.arrayBuffer()));
  });
});
