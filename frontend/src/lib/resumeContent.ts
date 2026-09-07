import type { ResumeProfileUpdate, StructuredResume } from "../types";
import { RESUME_JSON_SCHEMA, parseStructuredResumeJson } from "./resumeSchema";
import { profileDetails } from "./profileDetails";
import { masterSkills } from "./technicalSkills";

const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const list = (items: unknown) => ({ type: "array", items });
const reference = { type: "string" };
const sub = RESUME_JSON_SCHEMA.properties.experience.items.properties.subprojects.items;
const project = RESUME_JSON_SCHEMA.properties.projects.items.properties;

// Only editable content crosses the generation boundary; identity fields are assembled locally.
export const RESUME_CONTENT_SCHEMA = object({
  experience: list(object({ sourceId: reference, subprojects: list(object({ sourceId: reference, ...sub.properties })) })),
  projects: list(object({ sourceId: reference, technologies: project.technologies, bullets: project.bullets })),
  technicalSkills: RESUME_JSON_SCHEMA.properties.technicalSkills,
});

// Bind each response reference to the exact profile snapshot used by this request.
export function resumeContentSchema(profile: ResumeProfileUpdate) {
  const choices = (variants: unknown[], fallback: unknown) => variants.length
    ? list(variants.length === 1 ? variants[0] : { anyOf: variants })
    : { ...list(fallback), maxItems: 0 };
  const id = (sourceId: string) => ({ type: "string", enum: [sourceId] });
  const experience = roles(profile).filter(role => role.subprojects.length).map(role => object({
    sourceId: id(role.sourceId),
    subprojects: choices(role.subprojects.map((entry, index) => object({
      ...sub.properties,
      sourceId: id(`${role.sourceId}/sub:${index}`),
      name: entry.omitTitle ? { type: "string", enum: [""] } : sub.properties.name,
    })), sub),
  }));
  const projects = profile.projects.map((entry, index) => object({
    sourceId: id(`project:${index}`), technologies: project.technologies, bullets: project.bullets,
  }));
  return object({
    experience: choices(experience, object({ sourceId: reference, subprojects: list(sub) })),
    projects: choices(projects, object({ sourceId: reference, technologies: project.technologies, bullets: project.bullets })),
    technicalSkills: RESUME_JSON_SCHEMA.properties.technicalSkills,
  });
}

export function formatProfileDates(start: string, end: string, current = false): string {
  return [start.trim(), current ? "Present" : end.trim()].filter(Boolean).join(" -- ");
}

function roles(profile: ResumeProfileUpdate) {
  return [
    ...profile.workExperiences.map((entry, index) => ({ ...entry, sourceId: `work:${index}`, organization: entry.company, type: "work" as const })),
    ...profile.researchExperiences.map((entry, index) => ({ ...entry, sourceId: `research:${index}`, type: "research" as const })),
  ];
}

export function resumeContentSource(profile: ResumeProfileUpdate) {
  return {
    educationContext: profile.education.map(({ institution, degree }) => ({ institution, degree })),
    experience: roles(profile).map(role => ({
      sourceId: role.sourceId, organization: role.organization, title: role.title, type: role.type,
      subprojects: role.subprojects.map((entry, index) => ({
        sourceId: `${role.sourceId}/sub:${index}`, name: entry.omitTitle ? "" : entry.name,
        omitTitle: !!entry.omitTitle, details: profileDetails(entry),
      })),
    })),
    projects: profile.projects.map((entry, index) => ({
      sourceId: `project:${index}`, name: entry.name, technologies: entry.technologies, details: profileDetails(entry),
    })),
    skillInventory: masterSkills(profile),
    awards: profile.awards_text || "", other: profile.other_text || "",
  };
}

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid resume content object");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some(key => !(key in result))) throw new Error("Unexpected or missing resume content fields");
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected resume content array");
  return value;
}
function lookup<T extends { sourceId: string }>(value: unknown, available: T[], seen: Set<string>): T {
  if (typeof value !== "string") throw new Error("Resume source reference must be a string");
  const key = value.trim();
  if (seen.has(key)) throw new Error(`Duplicate resume source reference: ${key}`);
  const entry = available.find(item => item.sourceId === key);
  if (!entry) throw new Error(`Unknown resume source reference: ${key.slice(0, 100)}. Expected one of: ${available.map(item => item.sourceId).join(", ") || "(none)"}`);
  seen.add(key);
  return entry;
}

export function assembleResume(raw: string, profile: ResumeProfileUpdate): StructuredResume {
  const content = record(JSON.parse(raw), ["experience", "projects", "technicalSkills"]);
  const seenRoles = new Set<string>();
  const experience = array(content.experience).map(value => {
    const item = record(value, ["sourceId", "subprojects"]);
    const role = lookup(item.sourceId, roles(profile), seenRoles);
    const seenSubs = new Set<string>();
    const available = role.subprojects.map((entry, index) => ({ ...entry, sourceId: `${role.sourceId}/sub:${index}` }));
    return {
      organization: role.organization, title: role.title, location: role.location,
      dates: formatProfileDates(role.startDate, role.endDate, role.isCurrent), type: role.type,
      subprojects: array(item.subprojects).map(value => {
        const sub = record(value, ["sourceId", "name", "bullets"]);
        const source = lookup(sub.sourceId, available, seenSubs);
        if (typeof sub.name !== "string") throw new Error("Invalid subproject name");
        return { name: source.omitTitle ? "" : sub.name, bullets: sub.bullets };
      }),
    };
  });
  const seenProjects = new Set<string>();
  const projects = array(content.projects).map(value => {
    const item = record(value, ["sourceId", "technologies", "bullets"]);
    const source = lookup(item.sourceId, profile.projects.map((entry, index) => ({ ...entry, sourceId: `project:${index}` })), seenProjects);
    return { name: source.name, dates: source.dates, technologies: item.technologies, bullets: item.bullets };
  });
  const resume = {
    header: {
      name: [profile.firstName.trim(), profile.lastName.trim()].filter(Boolean).join(" "),
      email: profile.email, phone: profile.phone, location: profile.location,
      linkedin: profile.linkedin, github: profile.github, website: profile.website,
    },
    education: profile.education.map(entry => ({
      institution: entry.institution, degree: entry.degree, location: entry.location,
      dates: formatProfileDates(entry.startDate, entry.endDate), details: [],
    })),
    experience, projects, technicalSkills: content.technicalSkills,
  };
  return parseStructuredResumeJson(JSON.stringify(resume), profile.workExperiences.length > 0 && profile.researchExperiences.length > 0);
}
