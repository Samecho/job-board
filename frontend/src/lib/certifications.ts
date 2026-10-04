// Only web links may become certificate verification hyperlinks in exported resumes.
export function certificationUrl(value: string): string {
  const url = value.trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname && !parsed.username && !parsed.password) return url;
  } catch {}
  throw new Error("Certification verification links must be valid http:// or https:// URLs");
}
