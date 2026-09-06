export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type OpenAiModel = { id: string; label: string; input: number; output: number; efforts: ReasoningEffort[]; value?: boolean };
const modern: ReasoningEffort[] = ["none", "low", "medium", "high", "xhigh"];
const latest: ReasoningEffort[] = [...modern, "max"];
// USD / 1M tokens, standard processing. Official model pages, checked 2026-09-06.
export const PRICE_CHECKED = "2026-09-06";
export const OPENAI_MODELS: OpenAiModel[] = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", input: 0.2, output: 1.2, efforts: latest, value: true },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", input: 2, output: 12, efforts: latest },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", input: 4, output: 20, efforts: latest },
  { id: "gpt-6-astra", label: "GPT-6 Astra", input: 10, output: 50, efforts: ["low", "medium", "high", "xhigh", "max"] },
];
export const EFFORT_OUTPUT: Record<ReasoningEffort, number> = { none: 3000, minimal: 3500, low: 4500, medium: 6500, high: 10000, xhigh: 16000, max: 24000 };
export const modelInfo = (id: string) => OPENAI_MODELS.find(model => model.id === id);
export function defaultEffort(id: string): ReasoningEffort { return modelInfo(id)?.efforts.includes("low") ? "low" : "minimal"; }
// Local estimate only. The default JD is 700 English words, roughly 4,200 characters.
export function estimateInputTokens(text: string) {
  return Math.ceil(Array.from(text).reduce((total, character) => total + (character.codePointAt(0)! > 127 ? 1 : 0.25), 0)) + 1050;
}
export function scenarioCost(model: OpenAiModel, effort: ReasoningEffort, inputTokens: number) {
  return (inputTokens * model.input + EFFORT_OUTPUT[effort] * model.output) / 1e6;
}
export function priceLabel(model: OpenAiModel, effort = defaultEffort(model.id), inputTokens = 0) {
  const cost = scenarioCost(model, effort, inputTokens);
  return `${model.label} / ${effort} (est. $${cost.toFixed(4)})`;
}
