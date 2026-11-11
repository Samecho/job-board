import type { Analytics } from "../types";
import { layoutApplicationSankey, SANKEY_COLORS, SANKEY_NODE_WIDTH } from "../lib/applicationSankey";

export function ApplicationSankey({ analytics }: { analytics: Analytics }) {
  const total = analytics.total_applications;
  const { nodes, flows, width, height } = layoutApplicationSankey(analytics);
  return <section className="panel application-sankey">
    <div className="panel-head"><h2>Application Sankey</h2></div>
    {total ? <div className="sankey-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Application journeys. ${nodes.map(node => `${node.label} ${node.count}`).join(", ")}`}>
      <desc>OA and Interview include applications that later ended. Completed OAs awaiting a result merge into Pending; completion does not mean passed. Not completed includes active OAs without recorded completion, including unknown completion status. Missing references and incomplete assessments are not employer rejections. Rejected and Declined merge incoming paths into separate outcomes. Unrecorded earlier stages are not assumed.</desc>
      {flows.map(flow => <path key={`${flow.source}:${flow.target}`} d={flow.path} fill={SANKEY_COLORS[flow.target]} opacity={flow.target === "Pending" ? "0.42" : "0.48"}><title>{`${flow.source} to ${flow.target}: ${flow.count} applications`}</title></path>)}
      {nodes.map(node => <g key={node.stage} data-stage={node.stage} data-count={node.count}>
        <rect x={node.x} y={node.y} width={SANKEY_NODE_WIDTH} height={Math.max(node.height, 2)} fill={SANKEY_COLORS[node.stage]}><title>{`${node.label}: ${node.count}`}</title></rect>
        <text x={node.labelX} y={node.labelY} textAnchor={node.anchor as "start" | "middle" | "end"}>
          <tspan className="sankey-stage" x={node.labelX}>{node.label}</tspan>
          <tspan className="sankey-count" x={node.labelX} dy="17">{node.count}</tspan>
        </text>
      </g>)}
    </svg></div> : <p>No applications yet.</p>}
    {!!analytics.application_followups?.length && <details><summary>Assessment and reference details</summary><ul>{analytics.application_followups.map(item => <li key={item.id}><strong>{item.company_name}</strong> · {item.detail} · {item.job_title}</li>)}</ul></details>}
  </section>;
}
