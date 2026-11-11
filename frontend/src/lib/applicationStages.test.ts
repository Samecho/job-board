import { describe, expect, it } from "vitest";
import { applicationFlow, applicationHistory, applicationPath } from "./applicationStages";

describe("application journeys", () => {
  it("separates completed and unfinished OAs without inventing a passing result", () => {
    const flow = applicationFlow([
      { application_stage: "OA", assessment_status: "completed" },
      { application_stage: "OA", assessment_status: "not_completed" },
      { application_stage: "OA" },
      { application_stage: "Applied", reference_status: "unavailable" },
    ]);
    expect(flow.reached).toMatchObject({ Applied: 4, OA: 3, Interview: 0, Rejected: 0 });
    expect(flow.details).toEqual({ "OA completed": 1, "OA not completed": 1, "Reference unavailable": 1 });
    expect(flow.links).toContainEqual({ source: "OA", target: "OA completed", count: 1 });
    expect(flow.links).toContainEqual({ source: "OA", target: "OA not completed", count: 1 });
    expect(flow.links).toContainEqual({ source: "Applied", target: "Reference unavailable", count: 1 });
    expect(flow.links.some(link => link.target === "Pending")).toBe(false);
  });

  it("lets final outcomes supersede OA/reference details while preserving history", () => {
    expect(applicationPath({ application_stage: "Rejected", stage_history: ["OA"], assessment_status: "completed", reference_status: "unavailable" })).toEqual(["Applied", "OA", "Rejected"]);
    expect(applicationPath({ application_stage: "Interview", stage_history: ["OA"], assessment_status: "completed" })).toEqual(["Applied", "OA", "Interview"]);
    expect(applicationPath({ application_stage: "Applied", reference_status: "provided" })).toEqual(["Applied", "Pending"]);
  });
  it("retains two interviews while merging different final outcomes", () => {
    const flow = applicationFlow([
      { application_stage: "Rejected", stage_history: ["Applied", "Interview", "Rejected"] },
      { application_stage: "Declined", stage_history: ["Applied", "Interview", "Declined"] },
    ]);
    expect(flow.reached).toMatchObject({ Applied: 2, OA: 0, Interview: 2, Rejected: 1, Declined: 1 });
    expect(flow.links).toEqual([
      { source: "Applied", target: "Interview", count: 2 },
      { source: "Interview", target: "Rejected", count: 1 },
      { source: "Interview", target: "Declined", count: 1 },
    ]);
  });

  it("does not invent OA or interview history for legacy final stages", () => {
    expect(applicationPath({ application_stage: "Rejected" })).toEqual(["Applied", "Rejected"]);
    expect(applicationPath({ application_stage: "Offer" })).toEqual(["Applied", "Offer"]);
    expect(applicationPath({ application_stage: "Interview" })).toEqual(["Applied", "Interview"]);
  });

  it("counts each milestone once and preserves active endpoints", () => {
    const flow = applicationFlow([
      { application_stage: "Applied" },
      { application_stage: "OA", stage_history: ["Applied", "OA", "OA"] },
      { application_stage: "Interview", stage_history: ["Applied", "OA"] },
      { application_stage: "Rejected", stage_history: ["Applied", "OA", "Interview"] },
      { application_stage: "Rejected" },
    ]);
    expect(flow.reached).toEqual({ Applied: 5, OA: 3, Interview: 2, Rejected: 2, Declined: 0, Offer: 0 });
    expect(flow.links).toContainEqual({ source: "Applied", target: "Pending", count: 1 });
    expect(flow.links).toContainEqual({ source: "Applied", target: "OA", count: 3 });
    expect(flow.links).toContainEqual({ source: "OA", target: "Interview", count: 2 });
    expect(flow.links).toContainEqual({ source: "Interview", target: "Rejected", count: 1 });
    expect(flow.links).toContainEqual({ source: "Applied", target: "Rejected", count: 1 });
  });

  it("records a known current milestone when the outcome changes, without dates", () => {
    expect(applicationHistory({ application_stage: "Interview" }, "Declined")).toEqual(["Applied", "Interview", "Declined"]);
    expect(applicationFlow([])).toMatchObject({ links: [], reached: { Applied: 0, Interview: 0 } });
  });
});
