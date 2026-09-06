export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type OpenAiModel = { id: string; label: string; input: number; output: number; efforts: ReasoningEffort[]; value?: boolean };
const modern: ReasoningEffort[] = ["none", "low", "medium", "high", "xhigh"];
const latest: ReasoningEffort[] = [...modern, "max"];
// USD / 1M tokens, standard processing. Official model pages, checked 2026-09-06.
export const PRICE_CHECKED = "2026-09-06";
export const PRICE_VALID_UNTIL = "2026-10-06";
export const OPENAI_MODELS: OpenAiModel[] = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", input: 0.2, output: 1.2, efforts: latest, value: true },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", input: 2, output: 12, efforts: latest },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", input: 4, output: 20, efforts: latest },
  { id: "gpt-6-astra", label: "GPT-6 Astra", input: 10, output: 50, efforts: ["low", "medium", "high", "xhigh", "max"] },
];
export const EFFORT_OUTPUT: Record<ReasoningEffort, number> = { none: 3000, minimal: 3500, low: 4500, medium: 6500, high: 10000, xhigh: 16000, max: 24000 };
const MIN_OUTPUT: Record<ReasoningEffort, number> = { none: 2200, minimal: 2500, low: 3000, medium: 4000, high: 6000, xhigh: 9000, max: 12000 };
export const RESUME_BUDGET_USD = 0.05;
export const modelInfo = (id: string) => OPENAI_MODELS.find(model => model.id === id);
export function defaultEffort(id: string): ReasoningEffort { return modelInfo(id)?.efforts.includes("low") ? "low" : "minimal"; }
export function scenarioCost(model: OpenAiModel, effort: ReasoningEffort) {
  return (6000 * model.input + EFFORT_OUTPUT[effort] * model.output) / 1e6;
}
export function priceLabel(model: OpenAiModel, effort = defaultEffort(model.id)) {
  const cost = scenarioCost(model, effort);
  return `${model.label} / ${effort}${model.value ? " - value pick" : ""} (est. $${cost.toFixed(4)}${cost > RESUME_BUDGET_USD ? "; over $0.05 example" : ""})`;
}
export function budgetPlan(modelId: string, effort: ReasoningEffort, inputTokens: number, date = new Date()) {
  const model = modelInfo(modelId);
  if (!model || !model.efforts.includes(effort)) throw new Error("Unsupported model or reasoning setting. Choose a listed combination; no model substitution is performed.");
  if (date.getTime() > Date.parse(`${PRICE_VALID_UNTIL}T00:00:00Z`)) throw new Error("Pricing verification has expired. Update the price table before generating; no paid request was sent.");
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 || inputTokens > 50000) throw new Error("Input token count is invalid or too large for the $0.05 budget.");
  // Reserve 10% of the monetary cap, 128 input tokens, and a possible cache-write uplift.
  const inputAllowance = (inputTokens + 128) * model.input * 1.25 / 1e6;
  const available = Math.floor((0.045 - inputAllowance) * 1e6 / model.output);
  if (available < MIN_OUTPUT[effort]) throw new Error(`${model.label} / ${effort} cannot fit a complete resume within $0.05 with this input. Choose a lower reasoning effort or another model yourself. No generation request was sent.`);
  const maxOutputTokens = Math.min(available, EFFORT_OUTPUT[effort]);
  return { maxOutputTokens, inputTokens, upperBoundUsd: inputAllowance + maxOutputTokens * model.output / 1e6 };
}
