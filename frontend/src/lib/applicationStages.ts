import type { Application, ApplicationStage } from "../types";

export const APPLICATION_STAGES: ApplicationStage[] = ["Applied", "OA", "Interview", "Rejected", "Declined", "Offer"];
export const APPLICATION_MILESTONES: ApplicationStage[] = ["OA", "Interview"];
const outcomes: ApplicationStage[] = ["Rejected", "Declined", "Offer"];
type StageRecord = Pick<Application, "application_stage" | "stage_history" | "assessment_status" | "reference_status">;
export type FlowDetail = "OA completed" | "OA not completed" | "Reference unavailable";
export type FlowStage = ApplicationStage | "Pending" | FlowDetail;

export function applicationDetail(app: StageRecord): FlowDetail | undefined {
  if (app.application_stage === "OA") {
    if (app.assessment_status === "completed") return "OA completed";
    if (app.assessment_status === "not_completed") return "OA not completed";
  }
  if (app.application_stage === "Applied" && app.reference_status === "unavailable") return "Reference unavailable";
}

export function applicationHistory(app: StageRecord, nextStage = app.application_stage, history = app.stage_history): ApplicationStage[] {
  const reached = new Set(["Applied", ...(history || []), app.application_stage, nextStage]);
  return APPLICATION_STAGES.filter(stage => reached.has(stage));
}

export function applicationPath(app: StageRecord): FlowStage[] {
  const history = applicationHistory(app);
  const path: FlowStage[] = ["Applied", ...APPLICATION_MILESTONES.filter(stage => history.includes(stage))];
  if (outcomes.includes(app.application_stage)) path.push(app.application_stage);
  else {
    const detail = applicationDetail(app);
    if (detail) path.push(detail);
    else if (app.application_stage === "Applied") path.push("Pending");
  }
  return path;
}

export function applicationFlow(apps: StageRecord[]) {
  const reached = Object.fromEntries(APPLICATION_STAGES.map(stage => [stage, 0])) as Record<ApplicationStage, number>;
  const links = new Map<string, { source: ApplicationStage; target: FlowStage; count: number }>();
  const details: Partial<Record<FlowDetail, number>> = {};
  for (const app of apps) {
    const path = applicationPath(app);
    for (const stage of path) {
      if (APPLICATION_STAGES.includes(stage as ApplicationStage)) reached[stage as ApplicationStage] += 1;
      else if (stage !== "Pending") details[stage as FlowDetail] = (details[stage as FlowDetail] || 0) + 1;
    }
    for (let index = 1; index < path.length; index += 1) {
      const source = path[index - 1] as ApplicationStage;
      const target = path[index];
      const key = `${source}:${target}`;
      const link = links.get(key) || { source, target, count: 0 };
      link.count += 1;
      links.set(key, link);
    }
  }
  return { reached, links: [...links.values()], details };
}
