import { chromium } from "playwright-core";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const outputDir = path.resolve(process.cwd(), "..", ".runtime", "resume-e2e");
await mkdir(outputDir, { recursive: true });

const compactResume = {
  header: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+1 416 555 0100",
    location: "Toronto, ON",
    linkedin: "https://linkedin.com/in/ada_lovelace",
    github: "https://github.com/ada-lovelace",
    website: "https://ada.example.com",
  },
  education: [{
    institution: "University of British Columbia",
    location: "Vancouver, BC",
    degree: "BASc in Computer Engineering",
    dates: "Sep. 2024 -- Expected May 2029",
    details: ["Coursework: Operating Systems, Distributed Systems, and Machine Learning"],
  }],
  experience: [
    {
      organization: "Ericsson",
      title: "Automation Co-op, MLOps and Agentic AI",
      location: "Ottawa, ON",
      dates: "May 2026 -- Present",
      type: "work",
      subprojects: [
        {
          name: "Agentic Operations Intelligence Platform",
          bullets: [
            { text: "Engineered a modular Python agent runtime with structured tool calling and streaming.", highlights: ["Python", "structured tool calling"] },
            { text: "Built R&D Go services with 50% fewer errors and $5K savings.", highlights: ["Go", "50%"] },
          ],
        },
        {
          name: "TR Impact Analyzer",
          bullets: [
            { text: "Automated Kubernetes canary deployments and added OpenTelemetry tracing across 12 services.", highlights: ["Kubernetes", "OpenTelemetry"] },
            { text: "Improved numerical agreement to 1.2×10−16 while preserving ± tolerance, and x ≤ y ≥ z.", highlights: ["1.2×10−16"] },
          ],
        },
      ],
    },
    {
      organization: "University of British Columbia",
      title: "Undergraduate Researcher",
      location: "Vancouver, BC",
      dates: "Dec. 2025 -- Present",
      type: "research",
      subprojects: [
        {
          name: "Distributed Systems Research Project",
          bullets: [
            { text: "Designed reproducible distributed-systems experiments across an 80-node cluster.", highlights: ["80-node cluster"] },
            { text: "Built Rust tooling that reduced experiment setup time by 45 percent.", highlights: ["Rust"] },
          ],
        },
      ],
    },
  ],
  projects: [],
  technicalSkills: { categories: [
    { name: "Languages", skills: ["Go", "Rust", "Python", "C++"] },
    { name: "Engineering", skills: ["REST APIs", "Distributed Systems"] },
    { name: "Tools & Systems", skills: ["Docker", "Kubernetes", "Terraform", "GitHub Actions"] },
  ] },
};

const longResume = structuredClone(compactResume);
longResume.education[0].details = Array.from({ length: 6 }, (_, index) => `Detailed academic achievement ${index + 1} involving distributed systems, databases, operating systems, and machine learning.`);
longResume.experience = Array.from({ length: 8 }, (_, index) => ({
  organization: index < 6 ? `Engineering Organization ${index + 1}` : `Research Laboratory ${index - 5}`,
  title: index < 6 ? "Automation Co-op, MLOps and Agentic AI" : "Undergraduate Researcher",
  location: "Toronto, ON",
  dates: `Term ${index + 1}, 202${index % 7}`,
  type: index < 6 ? "work" : "research",
  subprojects: Array.from({ length: 2 }, (_, subIdx) => ({
    name: `Subproject ${subIdx + 1} for ${index < 6 ? "Work" : "Research"} ${index + 1}`,
    bullets: Array.from({ length: 3 }, (_, bullet) => ({
      text: `Implemented a production-grade distributed system capability ${bullet + 1} using Go, Rust, Kubernetes, PostgreSQL, observability, load testing, and automated deployment workflows with measurable reliability improvements.`,
      highlights: ["Go", "Kubernetes"],
    })),
  })),
}));
longResume.projects = Array.from({ length: 4 }, (_, index) => ({
  name: `Infrastructure Project ${index + 1}`,
  technologies: ["Rust", "Go", "Kubernetes", "PostgreSQL"],
  dates: "2026",
  bullets: Array.from({ length: 3 }, (_, bullet) => ({
    text: `Designed and benchmarked project component ${bullet + 1} under realistic failure and concurrency conditions.`,
    highlights: ["Rust"],
  })),
}));

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const browserErrors = [];
const failedRequests = [];
const networkRequests = [];
let aiRequestCount = 0;
let releaseGeneration;
const generationGate = new Promise(resolve => { releaseGeneration = resolve; });
page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text()); });
page.on("pageerror", error => browserErrors.push(error.message));
page.on("request", request => networkRequests.push(`${request.method()} ${request.url()}`));
page.on("requestfailed", request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));
page.on("response", response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });

await page.route("https://api.openai.com/**", async route => {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    return;
  }
  aiRequestCount += 1;
  if (aiRequestCount === 1) await generationGate;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ output_text: JSON.stringify(aiRequestCount === 1 ? longResume : compactResume) }),
  });
});

try {
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.evaluate(async ({ profile }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("internradar-browser", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(["resume_profile", "ai_settings"], "readwrite");
      transaction.objectStore("resume_profile").put({ id: 1, ...profile, updated_at: new Date().toISOString() });
      transaction.objectStore("ai_settings").put({ id: 1, provider: "openai", model: "gpt-5.6-sol", api_key: "e2e-local-key", updated_at: new Date().toISOString() });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, {
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+1 416 555 0100",
      location: "Toronto, ON",
      linkedin: "https://linkedin.com/in/ada_lovelace",
      github: "https://github.com/ada-lovelace",
      website: "https://ada.example.com",
      education: [{ institution: "University of British Columbia", degree: "BASc in Computer Engineering", location: "Vancouver, BC", startDate: "Sep. 2024", endDate: "Expected May 2029" }],
      workExperiences: [{
        company: "Ericsson",
        title: "Automation Co-op, MLOps and Agentic AI",
        location: "Ottawa, ON",
        startDate: "May 2026",
        endDate: "Present",
        isCurrent: true,
        subprojects: [
          { name: "Agentic Operations Intelligence Platform", bullets: [{ text: "Engineered Python runtime", highlights: ["Python"] }] },
          { name: "TR Impact Analyzer", bullets: [{ text: "Built analyzer", highlights: [] }] },
        ],
      }],
      researchExperiences: [{
        organization: "University of British Columbia",
        title: "Undergraduate Researcher",
        location: "Vancouver, BC",
        startDate: "Dec. 2025",
        endDate: "Present",
        isCurrent: true,
        subprojects: [{ name: "Distributed Systems Research Project", bullets: [{ text: "Designed experiments", highlights: [] }] }],
      }],
      projects: [],
      skills: { languages: ["Go", "Rust", "Python"], frameworks: ["React"], developerTools: ["Docker", "Kubernetes"], libraries: ["PyTorch"] },
      education_text: "",
      experience_text: "",
      projects_text: "",
      research_text: "",
      skills_text: "",
      awards_text: "",
      other_text: "",
      name: "Ada Lovelace",
    },
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.getByPlaceholder("Search companies, categories, locations...").fill("Jane Street");
  const companyRow = page.locator(".overview-table tbody tr").first();
  await companyRow.getByRole("button", { name: /^Resume/ }).click();
  await page.getByLabel("Job title").fill("Software Engineer Intern");
  await page.getByLabel("Job description").fill("Build reliable distributed backend services and infrastructure in Go, Kubernetes, PostgreSQL, and Terraform. Improve observability, latency, and production reliability.");
  await page.getByRole("button", { name: "Generate new version" }).click();
  await page.locator(".resume-modal .modal-head .icon-button").click();
  await page.locator("nav").getByRole("button", { name: "Analytics", exact: true }).click();
  const runningStatus = page.getByRole("button", { name: "Jane Street: Generating resume...", exact: true });
  await runningStatus.waitFor();
  await runningStatus.click();
  const runningButton = page.getByRole("button", { name: "Tailoring and compiling...", exact: true });
  await runningButton.waitFor();
  if (!await runningButton.isDisabled()) throw new Error("Reopened modal allows duplicate generation");
  await page.locator(".resume-modal .modal-head .icon-button").click();
  await page.locator("nav").getByRole("button", { name: "Overview", exact: true }).click();
  await runningStatus.click();
  releaseGeneration();
  await Promise.race([
    page.getByText("Version 1", { exact: true }).waitFor({ timeout: 180_000 }),
    page.locator(".resume-output .inline-error").waitFor({ timeout: 180_000 }).then(async () => { throw new Error(await page.locator(".resume-output .inline-error").innerText()); }),
  ]);

  if (aiRequestCount < 2) throw new Error(`Expected overflow compaction request, observed ${aiRequestCount} AI request(s)`);

  await page.getByRole("button", { name: "Preview PDF" }).click();
  await page.locator(".pdf-preview iframe").waitFor();
  const previewSource = await page.locator(".pdf-preview iframe").getAttribute("src");
  if (!previewSource?.startsWith("blob:")) throw new Error("PDF preview is not using the compiled PDF Blob");
  await page.locator(".pdf-preview .icon-button").click();

  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const pdfDownload = await pdfDownloadPromise;
  const pdfPath = path.join(outputDir, "resume-v1.pdf");
  await pdfDownload.saveAs(pdfPath);

  const texDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: ".tex", exact: true }).click();
  const texDownload = await texDownloadPromise;
  const texPath = path.join(outputDir, "resume-v1.tex");
  await texDownload.saveAs(texPath);

  const [pdfBytes, texSource] = await Promise.all([readFile(pdfPath), readFile(texPath, "utf8")]);
  const parser = new PDFParse({ data: pdfBytes });
  const pdfInfo = await parser.getInfo({ parsePageInfo: true });
  const pdfText = await parser.getText();
  await parser.destroy();
  if (pdfInfo.total !== 1) throw new Error(`Expected one PDF page, got ${pdfInfo.total}`);
  const [pageInfo] = pdfInfo.pages;
  if (!pageInfo || Math.abs(pageInfo.width - 612) > 1 || Math.abs(pageInfo.height - 792) > 1) throw new Error("Generated PDF is not US Letter size");
  for (const expected of ["Ada Lovelace", "Automation Co-op, MLOps and Agentic AI", "University of British Columbia", "Ericsson", "Agentic Operations Intelligence Platform", "TR Impact Analyzer", "Distributed Systems Research Project", "Technical Skills", "R&D", "50%", "Python"]) {
    if (!pdfText.text.includes(expected)) throw new Error(`ATS text extraction is missing: ${expected}`);
  }
  for (const label of ["Engineering", "Tools & Systems", "REST APIs"]) {
    if (!pdfText.text.includes(label)) throw new Error(`Dynamic skill category missing from PDF: ${label}`);
  }
  // Check highlights are bold (tex contains \textbf)
  if (!texSource.includes("\\textbf{Python}") && !texSource.includes("\\textbf{Go}")) throw new Error("Highlights not bold in tex");
  // Check subproject hierarchy
  if (!texSource.includes("\\resumeSubproject{Agentic Operations Intelligence Platform}")) throw new Error("Subproject macro missing");
  if (texSource.includes("\\section{Work Experience}") || texSource.includes("\\section{Research Experience}")) throw new Error("Should not have separate Work/Research sections, only EXPERIENCE");
  // Check dates from profile
  if (!pdfText.text.includes("May 2026 -- Present") && !texSource.includes("May 2026 -- Present")) throw new Error("Dates from profile missing");
  if (!texSource.includes("Sep. 2024 -- Expected May 2029") && !pdfText.text.includes("Sep. 2024")) throw new Error("Education dates missing");

  const links = pdfInfo.pages.flatMap(page => page.links.map(link => link.url));
  for (const expected of ["mailto:ada@example.com", "https://linkedin.com/in/ada_lovelace", "https://github.com/ada-lovelace", "https://ada.example.com"]) {
    if (!links.some(link => link.startsWith(expected))) throw new Error(`Compiled PDF is missing link: ${expected}`);
  }
  if (!texSource.includes("\\documentclass[letterpaper,11pt]{article}") || !texSource.includes("\\begin{document}") || !texSource.includes("\\end{document}")) throw new Error("Downloaded .tex is not standalone");
  if (/USER CONFIRMATION NEEDED|confirmation_needed|```/i.test(texSource)) throw new Error("Downloaded .tex contains forbidden AI output");

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText("No resume versions for this application yet.").waitFor();
  await page.locator(".app-picker button.active").filter({ hasText: "Software Engineer Intern" }).waitFor();

  console.log(JSON.stringify({
    aiRequestCount,
    previewSourceIsBlob: true,
    applicationPreservedAfterVersionDelete: true,
    pdfPages: pdfInfo.total,
    pdfPageSize: `${pageInfo.width}x${pageInfo.height}`,
    pdfLinkCount: links.length,
    atsTextVerified: true,
    pdfPath,
    texPath,
    browserErrors,
  }, null, 2));
} catch (error) {
  const screenshotPath = path.join(outputDir, "failure.png");
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    aiRequestCount,
    browserErrors,
    failedRequests,
    networkRequests,
    pageText: (await page.locator("body").innerText().catch(() => "")).slice(-6000),
    screenshotPath,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
