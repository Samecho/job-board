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
    institution: "University of Toronto",
    location: "Toronto, ON",
    degree: "BASc in Computer Engineering",
    dates: "2024 -- 2028",
    details: ["Coursework: Operating Systems, Distributed Systems, and Machine Learning"],
  }],
  experience: [
    {
      organization: "Example Cloud",
      title: "Software Engineer Intern",
      location: "Toronto, ON",
      dates: "May 2026 -- Aug 2026",
      type: "work",
      bullets: [
        "Built R&D Go services with 50% fewer errors and $5K savings.",
        "Automated Kubernetes canary deployments and added OpenTelemetry tracing across 12 services.",
      ],
    },
    {
      organization: "Systems Research Lab",
      title: "Undergraduate Researcher",
      location: "Toronto, ON",
      dates: "Sep 2025 -- Present",
      type: "research",
      bullets: [
        "Designed reproducible distributed-systems experiments across an 80-node cluster.",
        "Built Rust tooling that reduced experiment setup time by 45 percent.",
      ],
    },
  ],
  projects: [],
  technicalSkills: {
    languages: ["Go", "Rust", "Python", "C++"],
    frameworks: ["React", "FastAPI"],
    developerTools: ["Docker", "Kubernetes", "Terraform", "GitHub Actions"],
    libraries: ["PyTorch", "NumPy"],
  },
};

const longResume = structuredClone(compactResume);
longResume.education[0].details = Array.from({ length: 6 }, (_, index) => `Detailed academic achievement ${index + 1} involving distributed systems, databases, operating systems, and machine learning.`);
longResume.experience = Array.from({ length: 8 }, (_, index) => ({
  organization: index < 6 ? `Engineering Organization ${index + 1}` : `Research Laboratory ${index - 5}`,
  title: index < 6 ? "Software Engineering Intern" : "Undergraduate Researcher",
  location: "Toronto, ON",
  dates: `Term ${index + 1}, 202${index % 7}`,
  type: index < 6 ? "work" : "research",
  bullets: Array.from({ length: 5 }, (_, bullet) => `Implemented a production-grade distributed system capability ${bullet + 1} using Go, Rust, Kubernetes, PostgreSQL, observability, load testing, and automated deployment workflows with measurable reliability improvements.`),
}));
longResume.projects = Array.from({ length: 4 }, (_, index) => ({
  name: `Infrastructure Project ${index + 1}`,
  technologies: ["Rust", "Go", "Kubernetes", "PostgreSQL"],
  dates: "2026",
  bullets: Array.from({ length: 3 }, (_, bullet) => `Designed and benchmarked project component ${bullet + 1} under realistic failure and concurrency conditions.`),
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
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ output_text: JSON.stringify(aiRequestCount === 1 ? longResume : compactResume) }),
  });
});

try {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.evaluate(async ({ profile }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("internradar-browser", 2);
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
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+1 416 555 0100",
      location: "Toronto, ON",
      linkedin: "https://linkedin.com/in/ada_lovelace",
      github: "https://github.com/ada-lovelace",
      website: "https://ada.example.com",
      education_text: "BASc Computer Engineering at the University of Toronto, 2024-2028.",
      experience_text: "Software Engineer Intern building Go backend services, Kubernetes deployments, PostgreSQL systems, and observability.",
      projects_text: "Rust vector search engine and distributed job scheduler.",
      research_text: "Undergraduate researcher running distributed systems experiments on an 80-node cluster.",
      skills_text: "Go, Rust, Python, C++, Docker, Kubernetes, Terraform, PostgreSQL, OpenTelemetry.",
      awards_text: "",
      other_text: "",
    },
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.getByPlaceholder("Search companies, categories, locations...").fill("Jane Street");
  const companyRow = page.locator(".overview-table tbody tr").first();
  await companyRow.getByRole("button", { name: /^Resume/ }).click();
  await page.getByLabel("Job title").fill("Software Engineer Intern");
  await page.getByLabel("Job description").fill("Build reliable distributed backend services and infrastructure in Go, Kubernetes, PostgreSQL, and Terraform. Improve observability, latency, and production reliability.");
  await page.getByRole("button", { name: "Generate new version" }).click();
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
  for (const expected of ["Ada Lovelace", "Software Engineer Intern", "Undergraduate Researcher", "Technical Skills", "R&D", "50%"]) {
    if (!pdfText.text.includes(expected)) throw new Error(`ATS text extraction is missing: ${expected}`);
  }
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
