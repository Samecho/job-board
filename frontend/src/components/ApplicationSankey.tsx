import type { Analytics } from "../types";
import type { FlowStage } from "../lib/applicationStages";

const columns: FlowStage[][] = [["Applied"], ["OA"], ["Interview"], ["Pending", "Rejected", "Declined", "Offer"]];
const colors: Record<FlowStage, string> = {
  Applied: "#18aaa3", OA: "#3978d6", Interview: "#8a63cb",
  Pending: "#8996a5", Rejected: "#cf6b79", Declined: "#bc873c", Offer: "#56a574",
};

export function ApplicationSankey({ analytics }: { analytics: Analytics }) {
  const total = analytics.total_applications;
  const scale = 260 / Math.max(1, total);
  const counts: Record<FlowStage, number> = { ...analytics.applications_reached_stage, Pending: analytics.applications_by_stage.Applied };
  const nodes = columns.flatMap((stages, column) => {
    let y = 52;
    return stages.filter(stage => counts[stage] > 0).map(stage => {
      const height = counts[stage] * scale;
      const node = { stage, count: counts[stage], x: 32 + column * 270, y: column === 1 || column === 2 ? 182 - height / 2 : y, height, incoming: 0, outgoing: 0 };
      y += Math.max(height, 3) + 42;
      return node;
    });
  });
  const nodeMap = new Map(nodes.map(node => [node.stage, node]));
  const links = [...analytics.application_flows].sort((a, b) => (nodeMap.get(a.target)?.y ?? 0) - (nodeMap.get(b.target)?.y ?? 0));
  const flows = links.flatMap(link => {
    const source = nodeMap.get(link.source), target = nodeMap.get(link.target);
    if (!source || !target) return [];
    const thickness = link.count * scale;
    const flow = { ...link, thickness, x1: source.x + 14, x2: target.x, y1: source.y + source.outgoing, y2: target.y + target.incoming };
    source.outgoing += thickness;
    target.incoming += thickness;
    return [flow];
  });
  const height = Math.max(390, ...nodes.map(node => node.y + Math.max(node.height, 3) + 30));
  return <section className="panel application-sankey">
    <div className="panel-head"><h2>Application Sankey</h2><p>Confirmed stages reached, with final outcomes. Declined means you chose not to continue.</p></div>
    {total ? <div className="sankey-scroll"><svg viewBox={`0 0 1060 ${height}`} role="img" aria-label={`Application journeys. ${nodes.map(node => `${node.stage} ${node.count}`).join(", ")}`}>
      <desc>OA and Interview include applications that later ended. Rejected and Declined merge incoming paths into separate outcomes. Unrecorded earlier stages are not assumed.</desc>
      {flows.map(flow => {
        const curve = (flow.x1 + flow.x2) / 2;
        return <path key={`${flow.source}:${flow.target}`} d={`M ${flow.x1} ${flow.y1} C ${curve} ${flow.y1}, ${curve} ${flow.y2}, ${flow.x2} ${flow.y2} L ${flow.x2} ${flow.y2 + flow.thickness} C ${curve} ${flow.y2 + flow.thickness}, ${curve} ${flow.y1 + flow.thickness}, ${flow.x1} ${flow.y1 + flow.thickness} Z`} fill={colors[flow.target]} opacity="0.28"><title>{`${flow.source} to ${flow.target}: ${flow.count} applications`}</title></path>;
      })}
      {nodes.map(node => <g key={node.stage}>
        <rect x={node.x} y={node.y} width="14" height={Math.max(node.height, 3)} rx="2" fill={colors[node.stage]}><title>{`${node.stage}: ${node.count}`}</title></rect>
        <text x={node.x} y={node.y - 12}>{node.stage} ({node.count})</text>
      </g>)}
    </svg></div> : <p>No applications yet.</p>}
  </section>;
}
