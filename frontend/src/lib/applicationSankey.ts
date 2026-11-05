import type { Analytics } from "../types";
import type { FlowStage } from "./applicationStages";

type FlowData = Pick<Analytics, "total_applications" | "applications_by_stage" | "applications_reached_stage" | "application_flows">;
export const SANKEY_NODE_WIDTH = 10;
export const SANKEY_COLORS: Record<FlowStage, string> = {
  Applied: "#435268", Pending: "#b5b3ad", OA: "#a6a0d2", Interview: "#69a990",
  Rejected: "#cc686f", Declined: "#bf9759", Offer: "#75a070",
};

export function layoutApplicationSankey(analytics: FlowData) {
  const scale = 300 / Math.max(1, analytics.total_applications);
  const counts: Record<FlowStage, number> = { ...analytics.applications_reached_stage, Pending: analytics.applications_by_stage.Applied };
  const sourceY = 72;
  const oaY = sourceY + counts.Pending * scale + 32;
  const rejectedY = oaY + counts.OA * scale + 80;
  const interviewY = rejectedY + counts.Rejected * scale + 72;
  const offerY = interviewY + Math.max(counts.Interview, counts.Declined) * scale + 84;
  // The large pending ribbon stays above the progression lanes, not behind them.
  const positions: Array<{ stage: FlowStage; x: number; y: number; labelSide: "left" | "right" | "above" }> = [
    { stage: "Applied", x: 112, y: sourceY, labelSide: "left" },
    { stage: "Pending", x: 752, y: 24, labelSide: "right" },
    { stage: "OA", x: 422, y: oaY, labelSide: "above" },
    { stage: "Rejected", x: 752, y: rejectedY, labelSide: "right" },
    { stage: "Interview", x: 562, y: interviewY, labelSide: "above" },
    { stage: "Declined", x: 960, y: interviewY, labelSide: "right" },
    { stage: "Offer", x: 752, y: offerY, labelSide: "right" },
  ];
  const nodes = positions.filter(node => counts[node.stage] > 0).map(node => {
    const height = counts[node.stage] * scale;
    const anchor = node.labelSide === "left" ? "end" : node.labelSide === "above" ? "middle" : "start";
    return { ...node, count: counts[node.stage], height,
      label: node.stage === "Applied" ? "Applications" : node.stage,
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
