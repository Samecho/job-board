import { SOFTWARE_HIRING_SITES } from "../data/softwareHiringSites";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function matchesLocationFilter(company: { name: string }, input: string) {
  const query = normalize(input);
  if (!query) return true;
  return (SOFTWARE_HIRING_SITES[company.name] ?? []).some(group =>
    group.locations.some(site => normalize(site.city).includes(query) || normalize(site.country).includes(query))
  );
}
