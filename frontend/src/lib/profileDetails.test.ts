import { describe, expect, it } from "vitest";
import { profileDetails } from "./profileDetails";

describe("raw profile source migration", () => {
  it("preserves every legacy bullet and unmatched highlight without truncation", () => {
    const text = "Long source notes. ".repeat(200);
    expect(profileDetails({ bullets: [{ text, highlights: ["Long", "Kubernetes"] }, { text: "Second contribution", highlights: [] }] }))
      .toBe(`${text}\nKubernetes\n\nSecond contribution`);
  });
  it("uses edited details, including intentional deletion, instead of resurrecting archived bullets", () => {
    expect(profileDetails({ details: "", bullets: [{ text: "Old claim", highlights: [] }] })).toBe("");
    expect(profileDetails({ details: "messy\nraw notes & metrics", bullets: [] })).toBe("messy\nraw notes & metrics");
  });
});
