import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationSankey } from "./ApplicationSankey";
import { APPLICATION_STAGES, applicationFlow } from "../lib/applicationStages";
import type { Analytics, Application } from "../types";

function stats(apps: Pick<Application, "application_stage" | "stage_history">[]): Analytics {
  const flow = applicationFlow(apps);
  const counts = Object.fromEntries(APPLICATION_STAGES.map(stage => [stage, apps.filter(app => app.application_stage === stage).length])) as Analytics["applications_by_stage"];
  return { total_companies: 1, applied_count: apps.length ? 1 : 0, total_applications: apps.length,
    applications_by_stage: counts, applications_reached_stage: flow.reached, application_flows: flow.links,
    status_counts: {}, tier_counts: {}, applied_tier_counts: {}, saved_resume_count: 0, companies_with_resumes: 0, recent_resumes: [] };
}

describe("ApplicationSankey", () => {
  it("renders historical interviews flowing into separate final outcomes", () => {
    const markup = renderToStaticMarkup(<ApplicationSankey analytics={stats([
      { application_stage: "Rejected", stage_history: ["Applied", "Interview"] },
      { application_stage: "Declined", stage_history: ["Applied", "Interview"] },
    ])} />);
    expect(markup).toContain("Interview (2)");
    expect(markup).toContain("Rejected (1)");
    expect(markup).toContain("Declined (1)");
    expect(markup).toContain("Interview to Rejected: 1 applications");
    expect(markup).toContain("Interview to Declined: 1 applications");
    expect(markup).not.toContain("OA (2)");
    expect(markup).not.toContain("NaN");
  });

  it("handles empty data and does not invent historical stages", () => {
    expect(renderToStaticMarkup(<ApplicationSankey analytics={stats([])} />)).toContain("No applications yet.");
    const markup = renderToStaticMarkup(<ApplicationSankey analytics={stats([{ application_stage: "Rejected" }])} />);
    expect(markup).toContain("Applied to Rejected: 1 applications");
    expect(markup).not.toContain("Interview (1)");
  });
});
