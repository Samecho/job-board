import { describe, expect, it } from "vitest";
import { applicationFlow, APPLICATION_STAGES } from "./applicationStages";
import { layoutApplicationSankey } from "./applicationSankey";
import type { Analytics, Application } from "../types";

type Record = Pick<Application, "application_stage" | "stage_history" | "assessment_status" | "reference_status">;
type Ribbon = ReturnType<typeof layoutApplicationSankey>["flows"][number];
function ribbonY(flow: Ribbon, atX: number) {
  let low = 0, high = 1;
  for (let step = 0; step < 30; step += 1) {
    const t = (low + high) / 2, u = 1 - t;
    const x = u ** 3 * flow.x1 + 3 * u ** 2 * t * flow.controlX1 + 3 * u * t ** 2 * flow.controlX2 + t ** 3 * flow.x2;
    if (x < atX) low = t; else high = t;
  }
  const t = (low + high) / 2;
  return flow.y1 + (3 * t ** 2 - 2 * t ** 3) * (flow.y2 - flow.y1);
}
function data(apps: Record[]) {
  const flow = applicationFlow(apps);
  return { total_applications: apps.length, application_flows: flow.links, application_flow_details: flow.details, applications_reached_stage: flow.reached,
    applications_by_stage: Object.fromEntries(APPLICATION_STAGES.map(stage => [stage, apps.filter(app => app.application_stage === stage).length])) as Analytics["applications_by_stage"] };
}

describe("Sankey lane layout", () => {
  it("draws actionable detail branches with correct counts and separated endpoints", () => {
    const layout = layoutApplicationSankey(data([
      { application_stage: "OA", assessment_status: "completed" },
      { application_stage: "OA", assessment_status: "not_completed" },
      { application_stage: "Applied", reference_status: "unavailable" },
      { application_stage: "Applied" },
    ]));
    expect(layout.nodes.find(node => node.stage === "Pending")?.count).toBe(1);
    expect(layout.nodes.find(node => node.stage === "OA")?.count).toBe(2);
    for (const stage of ["OA completed", "OA not completed", "Reference unavailable"]) {
      expect(layout.nodes.find(node => node.stage === stage)?.count).toBe(1);
      expect(layout.flows.find(flow => flow.target === stage)).toBeDefined();
    }
    const completed = layout.nodes.find(node => node.stage === "OA completed")!;
    const incomplete = layout.nodes.find(node => node.stage === "OA not completed")!;
    expect(incomplete.y).toBeGreaterThan(completed.y + completed.height + 20);
    expect(layout.flows.every(flow => flow.x2 > flow.x1)).toBe(true);
  });
  const repeated = (count: number, application_stage: Application["application_stage"]): Record[] => Array.from({ length: count }, () => ({ application_stage }));

  it("keeps the dominant pending ribbon above both progression nodes", () => {
    const layout = layoutApplicationSankey(data([
      ...repeated(179, "Applied"), ...repeated(15, "OA"), ...repeated(26, "Rejected"), { application_stage: "Interview" },
    ]));
    const pending = layout.flows.find(flow => flow.target === "Pending")!;
    const pendingBottom = Math.max(pending.y1, pending.y2) + pending.thickness;
    for (const stage of ["OA", "Interview"]) {
      const node = layout.nodes.find(node => node.stage === stage)!;
      expect(node.y).toBeGreaterThan(pendingBottom + 20);
    }
    expect(layout.nodes.find(node => node.stage === "Pending")!.height / layout.nodes.find(node => node.stage === "Applied")!.height).toBeCloseTo(179 / 221);
    const oa = layout.nodes.find(node => node.stage === "OA")!;
    const rejection = layout.flows.find(flow => flow.source === "Applied" && flow.target === "Rejected")!;
    expect(ribbonY(rejection, oa.x)).toBeGreaterThan(oa.y + oa.height + 8);
    const forks = layout.flows.filter(flow => flow.source === "Applied").sort((a, b) => a.y1 - b.y1);
    for (let index = 1; index < forks.length; index += 1) {
      const upper = forks[index - 1], lower = forks[index];
      for (let sample = 1; sample < 30; sample += 1) {
        const x = upper.x1 + (Math.min(upper.x2, lower.x2) - upper.x1) * sample / 30;
        expect(ribbonY(upper, x) + upper.thickness).toBeLessThanOrEqual(ribbonY(lower, x) + 0.001);
      }
    }
  });

  it("merges interview outcomes without overlapping nodes or labels", () => {
    const layout = layoutApplicationSankey(data([
      ...repeated(179, "Applied"), ...repeated(15, "OA"), ...repeated(25, "Rejected"),
      { application_stage: "Rejected", stage_history: ["Applied", "Interview"] },
      { application_stage: "Declined", stage_history: ["Applied", "Interview"] },
    ]));
    expect(layout.flows.filter(flow => flow.source === "Interview").map(flow => flow.target).sort()).toEqual(["Declined", "Rejected"]);
    const pending = layout.nodes.find(node => node.stage === "Pending")!;
    const rejected = layout.nodes.find(node => node.stage === "Rejected")!;
    const interview = layout.nodes.find(node => node.stage === "Interview")!;
    const declined = layout.nodes.find(node => node.stage === "Declined")!;
    expect(rejected.x).toBe(pending.x);
    expect(rejected.y).toBeGreaterThan(pending.y + pending.height + 40);
    expect(interview.y).toBeGreaterThan(rejected.y + rejected.height + 40);
    expect(declined.x).toBeGreaterThan(interview.x);
    for (const node of layout.nodes) {
      expect(node.labelX).toBeGreaterThan(0);
      expect(node.labelX).toBeLessThan(layout.width - 80);
      expect(node.labelY).toBeGreaterThan(0);
      expect(node.y + node.height).toBeLessThan(layout.height);
    }
  });

  it.each(APPLICATION_STAGES)("handles all applications at %s without NaN or backward links", stage => {
    const layout = layoutApplicationSankey(data(repeated(50, stage)));
    expect(JSON.stringify(layout)).not.toMatch(/NaN|Infinity/);
    for (const flow of layout.flows) {
      expect(flow.x2).toBeGreaterThan(flow.x1);
      expect(flow.thickness).toBeGreaterThan(0);
    }
  });

  it("handles empty data without drawing phantom stages", () => {
    expect(layoutApplicationSankey(data([]))).toMatchObject({ nodes: [], flows: [], width: 1100 });
  });
});
