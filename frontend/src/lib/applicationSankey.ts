import type { Analytics } from "../types";
import type { FlowStage } from "./applicationStages";

type FlowData = Pick<Analytics, "total_applications" | "applications_by_stage" | "applications_reached_stage" | "application_flows" | "application_flow_details">;
export const SANKEY_NODE_WIDTH = 10;
export const SANKEY_COLORS: Record<FlowStage, string> = {
  Applied: "#435268", Pending: "#b5b3ad", OA: "#a6a0d2", Interview: "#69a990",
  Rejected: "#cc686f", Declined: "#bf9759", Offer: "#75a070",
  "OA completed": "#69a990", "OA not completed": "#bf9759", "Reference unavailable": "#8a929e",
};

export function layoutApplicationSankey(analytics: FlowData) {
  const scale = 300 / Math.max(1, analytics.total_applications);
  const details = analytics.application_flow_details;
  const counts: Record<FlowStage, number> = { ...analytics.applications_reached_stage,
    Pending: analytics.application_flows.filter(link => link.target === "Pending").reduce((sum, link) => sum + link.count, 0),
    "OA completed": details?.["OA completed"] || 0, "OA not completed": details?.["OA not completed"] || 0,
    "Reference unavailable": details?.["Reference unavailable"] || 0 };
  const sourceY = 72;
  const oaY = sourceY + counts.Pending * scale + 32;
  const oaIncompleteY = oaY;
  const rejectedY = Math.max(oaY + counts.OA * scale + 80, counts["OA not completed"] ? oaIncompleteY + counts["OA not completed"] * scale + 60 : 0);
  const interviewY = rejectedY + counts.Rejected * scale + 72;
  const offerY = interviewY + Math.max(counts.Interview, counts.Declined) * scale + 84;
  // The large pending ribbon stays above the progression lanes, not behind them.
  const positions: Array<{ stage: FlowStage; x: number; y: number; labelSide: "left" | "right" | "above" }> = [
    { stage: "Applied", x: 112, y: sourceY, labelSide: "left" },
    { stage: "Pending", x: 752, y: 24, labelSide: "right" },
    { stage: "OA", x: 422, y: oaY, labelSide: "above" },
    { stage: "OA not completed", x: 752, y: oaIncompleteY, labelSide: "right" },
    { stage: "Reference unavailable", x: 752, y: 24 + counts.Pending * scale + 32, labelSide: "right" },
    { stage: "Rejected", x: 752, y: rejectedY, labelSide: "right" },
    { stage: "Interview", x: 562, y: interviewY, labelSide: "above" },
    { stage: "Declined", x: 960, y: interviewY, labelSide: "right" },
    { stage: "Offer", x: 752, y: offerY, labelSide: "right" },
  ];
  const nodes = positions.filter(node => counts[node.stage] > 0).map(node => {
    const height = counts[node.stage] * scale;
    const anchor = node.labelSide === "left" ? "end" : node.labelSide === "above" ? "middle" : "start";
    return { ...node, count: counts[node.stage], height,
      label: node.stage === "Applied" ? "Applications" : node.stage === "OA not completed" ? "Not completed" : node.stage,
      labelX: node.labelSide === "left" ? node.x - 12 : node.labelSide === "above" ? node.x + SANKEY_NODE_WIDTH / 2 : node.x + SANKEY_NODE_WIDTH + 12,
      labelY: node.labelSide === "above" ? node.y - 26 : node.y + height / 2 - 4,
      anchor };
  });
  const nodeMap = new Map(nodes.map(node => [node.stage, node]));
  const links = analytics.application_flows.filter(link => link.count > 0 && nodeMap.has(link.source) && nodeMap.has(link.target));
  const outgoing = new Map<FlowStage, typeof links>();
  const incoming = new Map<FlowStage, typeof links>();
  const offset = (siblings: typeof links, link: typeof links[number]) => siblings.slice(0, siblings.indexOf(link)).reduce((sum, sibling) => sum + sibling.count * scale, 0);
  for (const node of nodes) {
    outgoing.set(node.stage, links.filter(link => link.source === node.stage).sort((a, b) => nodeMap.get(a.target)!.y - nodeMap.get(b.target)!.y));
  }
  const startY = (link: typeof links[number]) => nodeMap.get(link.source)!.y + offset(outgoing.get(link.source)!, link);
  for (const node of nodes) {
    incoming.set(node.stage, links.filter(link => link.target === node.stage).sort((a, b) => startY(a) - startY(b)));
  }
  const flows = links.map(link => {
    const source = nodeMap.get(link.source)!, target = nodeMap.get(link.target)!;
    const x1 = source.x + SANKEY_NODE_WIDTH, x2 = target.x;
    const y1 = startY(link);
    const y2 = target.y + offset(incoming.get(target.stage)!, link);
    const thickness = link.count * scale;
    // Shared endpoint handles keep sibling ribbons from overlapping near a fork.
    const controlX1 = x1 + Math.min(180, ...outgoing.get(source.stage)!.map(sibling => (nodeMap.get(sibling.target)!.x - x1) / 2));
    const controlX2 = x2 - Math.min(180, ...incoming.get(target.stage)!.map(sibling => (x2 - nodeMap.get(sibling.source)!.x - SANKEY_NODE_WIDTH) / 2));
    const path = `M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2} L ${x2} ${y2 + thickness} C ${controlX2} ${y2 + thickness}, ${controlX1} ${y1 + thickness}, ${x1} ${y1 + thickness} Z`;
    return { ...link, x1, x2, y1, y2, controlX1, controlX2, thickness, path };
  });
  return { nodes, flows, scale, width: 1100, height: Math.max(330, ...nodes.map(node => node.y + Math.max(node.height, 2) + 36)) };
}
