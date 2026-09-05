import type { ResumeBullet } from "../types";

// Keep legacy source material intact; an explicitly cleared details field stays cleared.
export function profileDetails(source: { details?: string; bullets?: ResumeBullet[] }): string {
  if (typeof source.details === "string") return source.details;
  return (source.bullets || []).map(bullet => {
    const extra = (bullet.highlights || []).filter(phrase => !bullet.text.includes(phrase));
    return [bullet.text, ...extra].filter(Boolean).join("\n");
  }).join("\n\n");
}
