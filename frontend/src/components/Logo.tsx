import { useEffect, useMemo, useState } from "react";

const localLogoBase = `${import.meta.env.BASE_URL}logos/`;

const localLogos: Record<string, string> = {
  ByteDance: `${localLogoBase}bytedance.svg`,
  "Five Rings": `${localLogoBase}five-rings.svg`,
  "Radix Trading": `${localLogoBase}radix-trading.png`,
  "Virtu Financial": `${localLogoBase}virtu-financial.svg`,
};

export function Logo({
  name,
  domain,
  url,
  size = 42,
}: {
  name: string;
  domain?: string;
  url: string | null;
  size?: number;
}) {
  const sources = useMemo(() => {
    const normalizedDomain = domain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return Array.from(new Set([
      localLogos[name] || "",
      normalizedDomain ? `https://${normalizedDomain}/favicon.ico` : "",
      normalizedDomain ? `https://www.google.com/s2/favicons?domain_url=https://${normalizedDomain}&sz=128` : "",
      normalizedDomain ? `https://icons.duckduckgo.com/ip3/${normalizedDomain}.ico` : "",
      url || "",
    ].filter(Boolean)));
  }, [domain, name, url]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);

  useEffect(() => setSourceIndex(0), [sources]);

  if (!sources[sourceIndex]) {
    return <span className="logo fallback" style={{ width: size, height: size }}>{initials}</span>;
  }

  return (
    <span className="logo" style={{ width: size, height: size }}>
      <img
        src={sources[sourceIndex]}
        alt={`${name} logo`}
        loading="lazy"
        onError={() => setSourceIndex(index => index + 1)}
      />
    </span>
  );
}
