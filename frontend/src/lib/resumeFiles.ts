import type { StructuredResume } from "../types";

const encoder = new TextEncoder();

function linesFromResume(resume: StructuredResume): string[] {
  const lines: string[] = [];
  const header = resume.header;
  lines.push(header.name || "Resume");
  lines.push([header.email, header.phone, header.location, header.linkedin, header.github, header.website].filter(Boolean).join(" | "));
  const section = (title: string, items: { title: string; subtitle?: string; location?: string; dates?: string; bullets: string[] }[]) => {
    if (!items.length) return;
    lines.push("");
    lines.push(title.toUpperCase());
    for (const item of items) {
      lines.push([item.title, item.subtitle, item.location, item.dates].filter(Boolean).join(" | "));
      item.bullets.filter(Boolean).slice(0, 5).forEach(bullet => lines.push(`- ${bullet}`));
    }
  };
  section("Education", resume.education || []);
  section("Experience", resume.experience || []);
  section("Projects", resume.projects || []);
  if (resume.skills?.length) {
    lines.push("");
    lines.push("SKILLS");
    resume.skills.filter(Boolean).forEach(skill => lines.push(skill));
  }
  if (resume.confirmation_needed?.length) {
    lines.push("");
    lines.push("USER CONFIRMATION NEEDED");
    resume.confirmation_needed.forEach(item => lines.push(`- ${item}`));
  }
  return lines;
}

function wrapText(text: string, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderResumePdf(resume: StructuredResume): Blob {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 44;
  const bodyLines = linesFromResume(resume).flatMap((line, index) => {
    const wrapped = wrapText(line, index === 0 ? 55 : 92);
    return wrapped.length ? wrapped : [""];
  }).slice(0, 58);

  const commands: string[] = ["BT", "/F1 10 Tf", `${margin} ${pageHeight - margin} Td`];
  bodyLines.forEach((line, index) => {
    const isHeading = index === 0 || /^[A-Z /]+$/.test(line);
    commands.push(`/${isHeading ? "F2" : "F1"} ${index === 0 ? 16 : isHeading ? 10.5 : 9.2} Tf`);
    if (index > 0) commands.push(`0 -${line ? 13 : 8} Td`);
    commands.push(`(${pdfEscape(line)}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function u16(value: number) { return [value & 255, (value >>> 8) & 255]; }
function u32(value: number) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }

export async function makeZip(files: Record<string, Blob | string>): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name.replace(/\\/g, "/"));
    const data = typeof content === "string" ? encoder.encode(content) : new Uint8Array(await content.arrayBuffer());
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(local, nameBytes, data);
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralOffset = offset;
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const count = Object.keys(files).length;
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(centralSize), ...u32(centralOffset), ...u16(0)]);
  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}

export function renderResumeDocx(resume: StructuredResume): Promise<Blob> {
  const paragraphs = linesFromResume(resume).map(line => `<w:p><w:r><w:t>${xmlEscape(line)}</w:t></w:r></w:p>`).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;
  return makeZip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": doc,
  }).then(blob => new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readStoreZip(blob: Blob): Promise<Record<string, Blob>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const files: Record<string, Blob> = {};
  let i = 0;
  const read32 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24);
  const read16 = (at: number) => bytes[at] | (bytes[at + 1] << 8);
  while (i < bytes.length - 4 && read32(i) === 0x04034b50) {
    const method = read16(i + 8);
    const size = read32(i + 18);
    const nameLength = read16(i + 26);
    const extraLength = read16(i + 28);
    const name = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLength));
    const start = i + 30 + nameLength + extraLength;
    if (method === 0) files[name] = new Blob([bytes.slice(start, start + size)]);
    i = start + size;
  }
  return files;
}
