import type { Analytics } from "../types";

const stages = ["Applied", "OA", "Interview", "Rejected", "Offer"] as const;
const colors = ["#18aaa3", "#3978d6", "#8a63cb", "#cf6b79", "#56a574"];

export function ApplicationSankey({ analytics }: { analytics: Analytics }) {
  const total = analytics.total_applications;
  const active = stages.filter(stage => analytics.applications_by_stage[stage] > 0);
  const scale = 240 / Math.max(1, total);
  const gap = 22;
  const height = 300 + Math.max(0, active.length - 1) * gap;
  let sourceY = 30;
  let targetY = 30;
  const flows = active.map(stage => {
    const count = analytics.applications_by_stage[stage];
    const thickness = count * scale;
    const flow = { stage, count, thickness, sourceY, targetY, color: colors[stages.indexOf(stage)] };
    sourceY += thickness;
    targetY += thickness + gap;
    return flow;
  });
  return <section className="panel application-sankey">
    <div className="panel-head"><h2>Application Sankey</h2><p>Applications by current stage, not historical transitions.</p></div>
    {total ? <svg viewBox={`0 0 720 ${height}`} role="img" aria-label={`Current application stages: ${stages.map(stage => `${stage} ${analytics.applications_by_stage[stage]}`).join(", ")}`}>
      <text x="18" y="18">All applications ({total})</text>
      {flows.map(flow => <g key={flow.stage}>
        <path d={`M 42 ${flow.sourceY} C 310 ${flow.sourceY}, 310 ${flow.targetY}, 555 ${flow.targetY} L 555 ${flow.targetY + flow.thickness} C 310 ${flow.targetY + flow.thickness}, 310 ${flow.sourceY + flow.thickness}, 42 ${flow.sourceY + flow.thickness} Z`} fill={flow.color} opacity="0.25"><title>{flow.stage}: {flow.count} applications</title></path>
        <rect x="555" y={flow.targetY} width="14" height={flow.thickness} rx="2" fill={flow.color} />
        <text x="585" y={flow.targetY + flow.thickness / 2} dominantBaseline="middle">{flow.stage} ({flow.count})</text>
      </g>)}
      <rect x="28" y="30" width="14" height="240" rx="2" fill="#18aaa3" />
    </svg> : <p>No applications yet.</p>}
  </section>;
}
