import type { StructuredResume } from "../types";

export const RESUME_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["header", "education", "experience", "projects", "technicalSkills"],
  properties: {
    header: {
      type: "object",
      additionalProperties: false,
      required: ["name", "email", "phone", "location", "linkedin", "github", "website"],
      properties: Object.fromEntries(
        ["name", "email", "phone", "location", "linkedin", "github", "website"].map(key => [key, { type: "string" }]),
      ),
    },
    education: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["institution", "location", "degree", "dates", "details"],
        properties: {
          institution: { type: "string" },
          location: { type: "string" },
          degree: { type: "string" },
          dates: { type: "string" },
          details: { type: "array", items: { type: "string" } },
        },
      },
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["organization", "title", "location", "dates", "type", "subprojects"],
        properties: {
          organization: { type: "string" },
          title: { type: "string" },
          location: { type: "string" },
          dates: { type: "string" },
          type: { type: "string", enum: ["work", "research"] },
          subprojects: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "bullets"],
              properties: {
                name: { type: "string" },
                bullets: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["text", "highlights"],
                    properties: {
                      text: { type: "string" },
                      highlights: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "technologies", "dates", "bullets"],
        properties: {
          name: { type: "string" },
          technologies: { type: "array", items: { type: "string" } },
          dates: { type: "string" },
          bullets: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "highlights"],
              properties: {
                text: { type: "string" },
                highlights: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
    technicalSkills: {
      type: "object",
      additionalProperties: false,
      required: ["languages", "frameworks", "developerTools", "libraries"],
      properties: {
        languages: { type: "array", items: { type: "string" } },
        frameworks: { type: "array", items: { type: "string" } },
        developerTools: { type: "array", items: { type: "string" } },
        libraries: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

type UnknownRecord = Record<string, unknown>;
const forbiddenContent = /USER CONFIRMATION NEEDED|```|\bmatch score\b|\binternal reasoning\b/i;

function asRecord(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as UnknownRecord;
}

function exactRecord(value: unknown, path: string, keys: string[]): UnknownRecord {
  const record = asRecord(value, path);
  const extra = Object.keys(record).filter(key => !keys.includes(key));
  const missing = keys.filter(key => !(key in record));
  if (extra.length || missing.length) {
    throw new Error(`${path} has invalid keys${missing.length ? `; missing ${missing.join(", ")}` : ""}${extra.length ? `; unexpected ${extra.join(", ")}` : ""}`);
  }
  return record;
}

function text(value: unknown, path: string, required = false): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  const result = value.trim();
  if (required && !result) throw new Error(`${path} cannot be empty`);
  if (forbiddenContent.test(result)) throw new Error(`${path} contains non-resume commentary`);
  return result;
}

function textArray(value: unknown, path: string, minimum = 0): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  const result = value.map((item, index) => text(item, `${path}[${index}]`, true));
  if (result.length < minimum) throw new Error(`${path} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`);
  return result;
}

function bulletObject(value: unknown, path: string): { text: string; highlights: string[] } {
  const record = asRecord(value, path);
  // allow legacy string bullet? but schema now expects object
  if (typeof value === "string") {
    const t = text(value, path, true);
    return { text: t, highlights: [] };
  }
  // support both strict object and legacy string in array
  const obj = exactRecord(value as unknown, path, ["text", "highlights"]);
  const txt = text(obj.text, `${path}.text`, true);
  if (!Array.isArray(obj.highlights)) throw new Error(`${path}.highlights must be an array`);
  const highlights = (obj.highlights as unknown[]).map((h, i) => text(h, `${path}.highlights[${i}]`, true)).filter(Boolean);
  if (highlights.length > 2) throw new Error(`${path}.highlights must contain at most 2 items`);
  for (const h of highlights) {
    if (h.length > 80) throw new Error(`${path}.highlights item too long`);
    if (/\\|{|}|\$|%|&|#|_|\^|~/.test(h) && /\\textbf|\\emph/.test(h)) throw new Error(`${path}.highlights must not contain LaTeX`);
  }
  return { text: txt, highlights };
}

function subprojectArray(value: unknown, path: string): Array<{ name: string; bullets: Array<{ text: string; highlights: string[] }> }> {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  if (!value.length) throw new Error(`${path} must contain at least one subproject`);
  return value.map((item, index) => {
    const rec = exactRecord(item, `${path}[${index}]`, ["name", "bullets"]);
    const name = text(rec.name, `${path}[${index}].name`, true);
    if (!Array.isArray(rec.bullets) || !rec.bullets.length) throw new Error(`${path}[${index}].bullets must contain at least one bullet`);
    const bullets = (rec.bullets as unknown[]).map((b, bi) => {
      // handle legacy string bullet inside subproject
      if (typeof b === "string") return { text: text(b, `${path}[${index}].bullets[${bi}]`, true), highlights: [] as string[] };
      return bulletObject(b, `${path}[${index}].bullets[${bi}]`);
    });
    return { name, bullets };
  });
}

function validateResume(value: unknown, requireBothExperienceTypes: boolean): StructuredResume {
  const root = exactRecord(value, "resume", ["header", "education", "experience", "projects", "technicalSkills"]);
  const headerValue = exactRecord(root.header, "header", ["name", "email", "phone", "location", "linkedin", "github", "website"]);
  const header = {
    name: text(headerValue.name, "header.name", true),
    email: text(headerValue.email, "header.email"),
    phone: text(headerValue.phone, "header.phone"),
    location: text(headerValue.location, "header.location"),
    linkedin: text(headerValue.linkedin, "header.linkedin"),
    github: text(headerValue.github, "header.github"),
    website: text(headerValue.website, "header.website"),
  };

  if (!Array.isArray(root.education) || !root.education.length) throw new Error("education must contain at least one entry");
  const education = root.education.map((value, index) => {
    const item = exactRecord(value, `education[${index}]`, ["institution", "location", "degree", "dates", "details"]);
    return {
      institution: text(item.institution, `education[${index}].institution`, true),
      location: text(item.location, `education[${index}].location`),
      degree: text(item.degree, `education[${index}].degree`, true),
      dates: text(item.dates, `education[${index}].dates`),
      details: textArray(item.details, `education[${index}].details`),
    };
  });

  if (!Array.isArray(root.experience) || !root.experience.length) throw new Error("experience must contain entries");
  const experience = root.experience.map((value, index) => {
    const raw = asRecord(value, `experience[${index}]`);
    // support legacy bullets: if bullets present and subprojects missing, convert
    if (Array.isArray(raw.bullets) && !raw.subprojects) {
      const kind = text(raw.type, `experience[${index}].type`, true);
      if (kind !== "work" && kind !== "research") throw new Error(`experience[${index}].type must be work or research`);
      const bullets = textArray(raw.bullets, `experience[${index}].bullets`, 1).map(t => ({ text: t, highlights: [] as string[] }));
      return {
        organization: text(raw.organization, `experience[${index}].organization`, true),
        title: text(raw.title, `experience[${index}].title`, true),
        location: text(raw.location, `experience[${index}].location`),
        dates: text(raw.dates, `experience[${index}].dates`),
        type: kind as "work" | "research",
        subprojects: [{ name: "", bullets }],
      };
    }
    const item = exactRecord(value, `experience[${index}]`, ["organization", "title", "location", "dates", "type", "subprojects"]);
    const kind = text(item.type, `experience[${index}].type`, true);
    if (kind !== "work" && kind !== "research") throw new Error(`experience[${index}].type must be work or research`);
    return {
      organization: text(item.organization, `experience[${index}].organization`, true),
      title: text(item.title, `experience[${index}].title`, true),
      location: text(item.location, `experience[${index}].location`),
      dates: text(item.dates, `experience[${index}].dates`),
      type: kind as "work" | "research",
      subprojects: subprojectArray(item.subprojects, `experience[${index}].subprojects`),
    };
  });
  if (requireBothExperienceTypes && (!experience.some(item => item.type === "work") || !experience.some(item => item.type === "research"))) {
    throw new Error("experience must include both work and research entries");
  }

  if (!Array.isArray(root.projects)) throw new Error("projects must be an array");
  const projects = root.projects.map((value, index) => {
    const item = exactRecord(value, `projects[${index}]`, ["name", "technologies", "dates", "bullets"]);
    const bulletsRaw = item.bullets as unknown[];
    const bullets = bulletsRaw.map((b, bi) => {
      if (typeof b === "string") return { text: text(b, `projects[${index}].bullets[${bi}]`, true), highlights: [] as string[] };
      return bulletObject(b, `projects[${index}].bullets[${bi}]`);
    });
    if (!bullets.length) throw new Error(`projects[${index}].bullets must contain at least one bullet`);
    return {
      name: text(item.name, `projects[${index}].name`, true),
      technologies: textArray(item.technologies, `projects[${index}].technologies`),
      dates: text(item.dates, `projects[${index}].dates`),
      bullets,
    };
  });

  const skillValue = exactRecord(root.technicalSkills, "technicalSkills", ["languages", "frameworks", "developerTools", "libraries"]);
  const technicalSkills = {
    languages: textArray(skillValue.languages, "technicalSkills.languages"),
    frameworks: textArray(skillValue.frameworks, "technicalSkills.frameworks"),
    developerTools: textArray(skillValue.developerTools, "technicalSkills.developerTools"),
    libraries: textArray(skillValue.libraries, "technicalSkills.libraries"),
  };
  if (!Object.values(technicalSkills).some(items => items.length)) throw new Error("technicalSkills must contain at least one skill");

  return { header, education, experience, projects, technicalSkills };
}

export function parseStructuredResumeJson(raw: string): StructuredResume {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error("AI response was not strict JSON");
  }
  return validateResume(parsed, true);
}

function legacyString(record: UnknownRecord, key: string): string {
  return typeof record[key] === "string" ? (record[key] as string).trim() : "";
}

function legacyArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === "string" && item.trim()).map(item => (item as string).trim()) : [];
}

export function normalizeStoredStructuredResume(value: unknown): StructuredResume {
  try {
    return validateResume(value, false);
  } catch {
    const legacy = asRecord(value, "stored resume");
    const legacyHeader = asRecord(legacy.header || {}, "stored resume header");
    const header = {
      name: legacyString(legacyHeader, "name"),
      email: legacyString(legacyHeader, "email"),
      phone: legacyString(legacyHeader, "phone"),
      location: legacyString(legacyHeader, "location"),
      linkedin: legacyString(legacyHeader, "linkedin"),
      github: legacyString(legacyHeader, "github"),
      website: legacyString(legacyHeader, "website"),
    };
    const education = (Array.isArray(legacy.education) ? legacy.education : []).map(value => {
      const item = asRecord(value, "stored education");
      return {
        institution: legacyString(item, "title"),
        location: legacyString(item, "location"),
        degree: legacyString(item, "subtitle"),
        dates: legacyString(item, "dates"),
        details: legacyArray(item.bullets),
      };
    });
    const experience = (Array.isArray(legacy.experience) ? legacy.experience : []).map(value => {
      const item = asRecord(value, "stored experience");
      const combined = `${legacyString(item, "title")} ${legacyString(item, "subtitle")}`;
      const bullets = legacyArray(item.bullets).map(t => ({ text: t, highlights: [] as string[] }));
      // legacy stored experience had no subprojects, convert to single subproject
      const subprojects = bullets.length ? [{ name: "", bullets }] : [];
      // also handle new stored form that already has subprojects
      const rawSub = (item as unknown as { subprojects?: unknown }).subprojects;
      const finalSubprojects = Array.isArray(rawSub) && rawSub.length ? (rawSub as Array<{ name: string; bullets: Array<{ text: string; highlights: string[] }> }>) : subprojects;
      return {
        organization: legacyString(item, "title"),
        title: legacyString(item, "subtitle"),
        location: legacyString(item, "location"),
        dates: legacyString(item, "dates"),
        type: /research|laboratory|academic|university/i.test(combined) ? "research" as const : "work" as const,
        subprojects: finalSubprojects.length ? finalSubprojects : [{ name: "General", bullets: [{ text: "Contributed to team deliverables.", highlights: [] }] }],
      } as StructuredResume["experience"][number];
    });
    const projects = (Array.isArray(legacy.projects) ? legacy.projects : []).map(value => {
      const item = asRecord(value, "stored project");
      const bullets = legacyArray(item.bullets).map(t => ({ text: t, highlights: [] as string[] }));
      return {
        name: legacyString(item, "title"),
        technologies: legacyString(item, "subtitle").split(/[,|]/).map(part => part.trim()).filter(Boolean),
        dates: legacyString(item, "dates"),
        bullets: bullets.length ? bullets : [{ text: "Built project.", highlights: [] }],
      };
    });
    const technicalSkills = { languages: [] as string[], frameworks: [] as string[], developerTools: [] as string[], libraries: [] as string[] };
    for (const line of legacyArray(legacy.skills)) {
      const [label, ...rest] = line.split(":");
      const values = (rest.length ? rest.join(":") : label).split(",").map(part => part.trim()).filter(Boolean);
      if (/language/i.test(label)) technicalSkills.languages.push(...values);
      else if (/framework/i.test(label)) technicalSkills.frameworks.push(...values);
      else if (/librar/i.test(label)) technicalSkills.libraries.push(...values);
      else technicalSkills.developerTools.push(...values);
    }
    return { header, education, experience, projects, technicalSkills } as StructuredResume;
  }
}

function cloneResume(resume: StructuredResume): StructuredResume {
  return JSON.parse(JSON.stringify(resume)) as StructuredResume;
}

function getAllBullets(experience: StructuredResume["experience"][number]): Array<{ text: string; highlights: string[] }> {
  if (experience.subprojects?.length) return experience.subprojects.flatMap(s => s.bullets);
  return ((experience as unknown as { bullets?: string[] }).bullets || []).map(t => ({ text: t, highlights: [] }));
}

export function trimLowestPriorityContent(resume: StructuredResume): StructuredResume | null {
  const next = cloneResume(resume);
  // Remove lower-ranked redundant bullets first without reserving a fixed quota.
  for (const exp of [...next.experience].reverse()) {
    const subs = exp.subprojects || [];
    for (const sub of [...subs].reverse()) {
      if (sub.bullets.length > 1) { sub.bullets.pop(); return next; }
    }
  }
  // legacy bullets
  const verboseExperienceLegacy = [...next.experience].reverse().find(item => {
    const legacy = (item as unknown as { bullets?: string[] }).bullets;
    return legacy && legacy.length > 1;
  });
  if (verboseExperienceLegacy) { (verboseExperienceLegacy as unknown as { bullets: string[] }).bullets.pop(); return next; }

  const verboseProject = [...next.projects].reverse().find(item => item.bullets.length > 1);
  if (verboseProject) { verboseProject.bullets.pop(); return next; }
  if (next.projects.length) { next.projects.pop(); return next; }

  const educationWithDetail = [...next.education].reverse().find(item => item.details.length);
  if (educationWithDetail) { educationWithDetail.details.pop(); return next; }

  const skillGroups: Array<keyof StructuredResume["technicalSkills"]> = ["libraries", "developerTools", "frameworks", "languages"];
  const skillCount = Object.values(next.technicalSkills).reduce((sum, items) => sum + items.length, 0);
  for (const group of skillGroups) {
    if (next.technicalSkills[group].length && skillCount > 1) { next.technicalSkills[group].pop(); return next; }
  }

  // trim any experience subproject with >1 bullet
  for (const exp of [...next.experience].reverse()) {
    const subs = exp.subprojects || [];
    for (const sub of [...subs].reverse()) {
      if (sub.bullets.length > 1) { sub.bullets.pop(); return next; }
    }
    const legacy = (exp as unknown as { bullets?: string[] }).bullets;
    if (legacy && legacy.length > 1) { legacy.pop(); return next; }
  }

  // remove an entire subproject if it has only 1 bullet and there are multiple subprojects
  for (const exp of [...next.experience].reverse()) {
    if (exp.subprojects && exp.subprojects.length > 1) {
      exp.subprojects.pop();
      return next;
    }
  }

  for (let index = next.experience.length - 1; index >= 0; index -= 1) {
    const kind = next.experience[index].type;
    if (next.experience.filter(item => item.type === kind).length > 1) {
      next.experience.splice(index, 1);
      return next;
    }
  }

  if (next.education.length > 1) { next.education.pop(); return next; }
  return null;
}

export function isResumeUnderfilled(resume: StructuredResume, pdfBytes?: Uint8Array): boolean {
  // deterministic heuristic: count bullets and text length
  const expBullets = resume.experience.reduce((sum, e) => sum + ((e.subprojects || []).reduce((s, sub) => s + sub.bullets.length, 0) || getAllBullets(e).length), 0);
  const projBullets = resume.projects.reduce((sum, p) => sum + p.bullets.length, 0);
  const totalBullets = expBullets + projBullets;
  const eduDetails = resume.education.reduce((sum, e) => sum + e.details.length, 0);
  const skillCount = Object.values(resume.technicalSkills).reduce((s, arr) => s + arr.length, 0);
  // Very dense CS resume typically has 10-16 bullets, 3-6 skills groups
  // If we have < 8 bullets and < 3 details and projects empty, likely underfilled
  // Also use PDF geometry if available: check text length
  if (pdfBytes) {
    try {
      const text = new TextDecoder("latin1").decode(pdfBytes);
      // Rough check: underfilled if PDF is small or has little text
      // For now fallback to bullet count
    } catch {}
  }
  const totalDetails = eduDetails;
  const hasProjects = resume.projects.length > 0;
  // Heuristic: underfilled if totalBullets < 8 and we have spare capacity (could add)
  // Also consider skill count
  if (totalBullets < 9 && (totalDetails < 3 || !hasProjects || skillCount < 6)) return true;
  if (totalBullets < 6) return true;
  return false;
}
