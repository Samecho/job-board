import { PdfLatex } from "@typeward/texlive-wasm";
import type { StructuredResume } from "../types";

const textReplacements: Array<[RegExp, string]> = [
  [/\u00e2\u20ac\u2122/g, "'"],
  [/\u00e2\u20ac\u0153|\u00e2\u20ac\u009d/g, '"'],
  [/\u00e2\u20ac\u201c|\u00e2\u20ac\u201d/g, "---"],
  [/\u2018|\u2019/g, "'"],
  [/\u201c|\u201d/g, '"'],
  [/\u2013/g, "--"],
  [/\u2014/g, "---"],
  [/\u2022/g, "-"],
  [/\u00a0/g, " "],
  [/\u200b|\ufeff/g, ""],
];

export function normalizeResumeText(value: string): string {
  let normalized = value;
  for (const [pattern, replacement] of textReplacements) normalized = normalized.replace(pattern, replacement);
  return normalized.normalize("NFKC").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

const latexCharacters: Record<string, string> = {
  "\\": "$\\backslash$",
  "&": "\\&",
  "%": "\\%",
  "$": "{\\char36}",
  "#": "\\#",
  "_": "{\\ttfamily\\char95}",
  "{": "\\{",
  "}": "\\}",
  "~": "{\\ttfamily\\char126}",
  "^": "{\\ttfamily\\char94}",
  "×": "$\\times$",
  "−": "$-$",
  "±": "$\\pm$",
  "≤": "$\\leq$",
  "≥": "$\\geq$",
};

export function escapeLatex(value: string): string {
  return [...normalizeResumeText(value)].map(character => latexCharacters[character] || character).join("");
}

export function escapeLatexUrl(value: string): string {
  return normalizeResumeText(value)
    .replace(/\\/g, "%5C")
    .replace(/{/g, "%7B")
    .replace(/}/g, "%7D")
    .replace(/~/g, "%7E")
    .replace(/\^/g, "%5E")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/&/g, "\\&");
}

function webUrl(value: string): string {
  const normalized = normalizeResumeText(value);
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}

function displayUrl(value: string): string {
  return normalizeResumeText(value).replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function href(target: string, label: string): string {
  return `\\href{${escapeLatexUrl(target)}}{${escapeLatex(label)}}`;
}

function headerItems(header: StructuredResume["header"]): string[] {
  const items: string[] = [];
  if (header.phone) {
    const telephone = normalizeResumeText(header.phone).replace(/[^+\d]/g, "");
    items.push(telephone ? href(`tel:${telephone}`, header.phone) : escapeLatex(header.phone));
  }
  if (header.email) items.push(href(`mailto:${normalizeResumeText(header.email)}`, header.email));
  if (header.location) items.push(escapeLatex(header.location));
  if (header.linkedin) items.push(href(webUrl(header.linkedin), displayUrl(header.linkedin)));
  if (header.github) items.push(href(webUrl(header.github), displayUrl(header.github)));
  if (header.website) items.push(href(webUrl(header.website), displayUrl(header.website)));
  return items;
}

function itemList(items: string[]): string {
  if (!items.length) return "";
  return ["\\resumeItemListStart", ...items.map(item => `  \\resumeItem{${escapeLatex(item)}}`), "\\resumeItemListEnd"].join("\n");
}

function educationSection(resume: StructuredResume): string {
  const entries = resume.education.map(entry => [
    `  \\resumeSubheading{${escapeLatex(entry.institution)}}{${escapeLatex(entry.dates)}}{${escapeLatex(entry.degree)}}{${escapeLatex(entry.location)}}`,
    entry.details.length ? `  ${itemList(entry.details).replace(/\n/g, "\n  ")}` : "",
  ].filter(Boolean).join("\n"));
  return ["\\section{Education}", "\\resumeSubHeadingListStart", ...entries, "\\resumeSubHeadingListEnd"].join("\n");
}

function experienceSection(resume: StructuredResume): string {
  const entries = resume.experience.map(entry => [
    `  \\resumeSubheading{${escapeLatex(entry.title)}}{${escapeLatex(entry.dates)}}{${escapeLatex(entry.organization)}}{${escapeLatex(entry.location)}}`,
    `  ${itemList(entry.bullets).replace(/\n/g, "\n  ")}`,
  ].join("\n"));
  return ["\\section{Experience}", "\\resumeSubHeadingListStart", ...entries, "\\resumeSubHeadingListEnd"].join("\n");
}

function projectsSection(resume: StructuredResume): string {
  if (!resume.projects.length) return "";
  const entries = resume.projects.map(project => {
    const technologies = project.technologies.length ? ` $|$ \\emph{${escapeLatex(project.technologies.join(", "))}}` : "";
    return [
      `  \\resumeProjectHeading{\\textbf{${escapeLatex(project.name)}}${technologies}}{${escapeLatex(project.dates)}}`,
      `  ${itemList(project.bullets).replace(/\n/g, "\n  ")}`,
    ].join("\n");
  });
  return ["\\section{Projects}", "\\resumeSubHeadingListStart", ...entries, "\\resumeSubHeadingListEnd"].join("\n");
}

function technicalSkillsSection(resume: StructuredResume): string {
  const groups: Array<[string, string[]]> = [
    ["Languages", resume.technicalSkills.languages],
    ["Frameworks", resume.technicalSkills.frameworks],
    ["Developer Tools", resume.technicalSkills.developerTools],
    ["Libraries", resume.technicalSkills.libraries],
  ];
  const rows = groups.filter(([, values]) => values.length).map(([label, values]) => `    \\textbf{${label}}{: ${escapeLatex(values.join(", "))}} \\\\`);
  return [
    "\\section{Technical Skills}",
    " \\resumeSubHeadingListStart",
    "  \\small{\\item{",
    ...rows,
    "  }}",
    " \\resumeSubHeadingListEnd",
  ].join("\n");
}

export function renderResumeLatex(resume: StructuredResume): string {
  const contact = headerItems(resume.header).join(" $|$ ");
  const projects = projectsSection(resume);
  return String.raw`% Jake's Resume-style fixed renderer
% Layout based on https://github.com/jakegut/resume (MIT License)
\pdfobjcompresslevel=0
\documentclass[letterpaper,11pt]{article}

\usepackage[utf8]{inputenc}
\usepackage[hidelinks]{hyperref}
\IfFileExists{glyphtounicode.tex}{\input{glyphtounicode}}{}

\pagestyle{empty}
\setlength{\oddsidemargin}{-0.25in}
\setlength{\evensidemargin}{-0.25in}
\setlength{\textwidth}{7in}
\setlength{\topmargin}{-0.6in}
\setlength{\textheight}{10in}
\setlength{\headheight}{0pt}
\setlength{\headsep}{0pt}
\setlength{\footskip}{0.25in}
\setlength{\parindent}{0pt}
\setlength{\tabcolsep}{0in}

\urlstyle{same}
\raggedbottom
\raggedright
\renewcommand{\section}[1]{\par\vspace{6pt}\noindent{\large\scshape #1}\par\vspace{2pt}\hrule\vspace{5pt}}
\pdfgentounicode=1

\newcommand{\resumeItem}[1]{\item\small{#1}}
\newcommand{\resumeSubheading}[4]{
  \item
  \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & #2 \\
    \textit{\small#3} & \textit{\small #4} \\
  \end{tabular*}\vspace{1pt}
}
\newcommand{\resumeProjectHeading}[2]{
  \item
  \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
    \small#1 & #2 \\
  \end{tabular*}\vspace{1pt}
}
\newcommand{\resumeItemListStart}{\begin{list}{$\bullet$}{\setlength{\leftmargin}{0.25in}\setlength{\itemsep}{0pt}\setlength{\parsep}{0pt}\setlength{\topsep}{2pt}}}
\newcommand{\resumeItemListEnd}{\end{list}\vspace{2pt}}
\newcommand{\resumeSubHeadingListStart}{\begin{list}{}{\setlength{\leftmargin}{0.15in}\setlength{\itemsep}{0pt}\setlength{\parsep}{0pt}\setlength{\topsep}{0pt}}}
\newcommand{\resumeSubHeadingListEnd}{\end{list}}

\begin{document}

\begin{center}
  \textbf{\Huge \scshape ${escapeLatex(resume.header.name)}} \\ \vspace{1pt}
  \small ${contact}
\end{center}

${educationSection(resume)}

${experienceSection(resume)}
${projects ? `\n${projects}\n` : ""}
${technicalSkillsSection(resume)}

\end{document}
`;
}

function staticAssetUrl(path: string): string {
  if (typeof window === "undefined") throw new Error("Browser-side LaTeX compilation requires a browser");
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href;
}

let compiler: PdfLatex | null = null;

function getCompiler(): PdfLatex {
  if (!compiler) {
    compiler = new PdfLatex({
      enginePath: staticAssetUrl("texlive-wasm/pdflatex/emscripten/pdflatex.wasm"),
      bundleUrl: staticAssetUrl("texlive-wasm/texmf-core-pdflatex.bundle"),
      useWorker: true,
      verbose: "silent",
    });
  }
  return compiler;
}

export function inspectPdf(bytes: Uint8Array): { pageCount: number; isUsLetter: boolean; hasLinks: boolean } {
  const source = new TextDecoder("latin1").decode(bytes);
  const pageCount = source.match(/\/Type\s*\/Page(?!s)\b/g)?.length || 0;
  const isUsLetter = /\/MediaBox\s*\[\s*0(?:\.0+)?\s+0(?:\.0+)?\s+612(?:\.0+)?\s+792(?:\.0+)?\s*\]/.test(source);
  const hasLinks = /\/Subtype\s*\/Link\b/.test(source) && /\/URI\b/.test(source);
  return { pageCount, isUsLetter, hasLinks };
}

export async function compileResumeLatex(texSource: string): Promise<{ pdfFile: Blob; pdfBytes: Uint8Array; pageCount: number; log: string }> {
  const engine = getCompiler();
  try {
    const result = await engine.compile({
      mainTex: "main.tex",
      files: [{ path: "main.tex", content: texSource }],
      interaction: "nonstopmode",
      haltOnError: true,
      timeoutMs: 120_000,
      extraArgs: ["-no-shell-escape"],
    });
    const pdfBytes = result.outputs.get("main.pdf") || [...result.outputs.entries()].find(([path]) => path.endsWith(".pdf"))?.[1];
    if (result.exitCode !== 0 || !pdfBytes) {
      const detail = (result.log || result.stderr || result.stdout).slice(-2400);
      throw new Error(`LaTeX compilation failed${detail ? `: ${detail}` : ""}`);
    }
    const inspection = inspectPdf(pdfBytes);
    if (!inspection.pageCount) throw new Error("Compiled PDF page count could not be detected");
    if (!inspection.isUsLetter) throw new Error("Compiled PDF is not US Letter size");
    const buffer = Uint8Array.from(pdfBytes).buffer;
    return { pdfFile: new Blob([buffer], { type: "application/pdf" }), pdfBytes, pageCount: inspection.pageCount, log: result.log };
  } catch (error) {
    console.error("Browser LaTeX compilation failed", error instanceof Error ? error.stack : error);
    await compiler?.dispose().catch(() => undefined);
    compiler = null;
    throw error;
  }
}