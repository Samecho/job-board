import { SOFTWARE_HIRING_SITES } from "../data/softwareHiringSites";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function getSoftwareHiringLocations(company: { name: string }) {
  const locations = new Map<string, { city: string; country: string; source: string; description: string }>();
  for (const group of SOFTWARE_HIRING_SITES[company.name] ?? []) {
    for (const site of group.locations) {
      const key = `${normalize(site.city)}|${normalize(site.country)}`;
      if (!locations.has(key)) locations.set(key, { ...site, source: group.source, description: group.description });
    }
  }
  return [...locations.values()];
}

export function matchesLocationFilter(company: { name: string }, input: string) {
  const query = normalize(input);
  if (!query) return true;
  return (SOFTWARE_HIRING_SITES[company.name] ?? []).some(group =>
    group.locations.some(site => normalize(site.city).includes(query) || normalize(site.country).includes(query))
  );
}
