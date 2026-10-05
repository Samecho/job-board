export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type OpenAiModel = { id: string; label: string; input: number; output: number; efforts: ReasoningEffort[]; value?: boolean };
const modern: ReasoningEffort[] = ["none", "low", "medium", "high", "xhigh"];
const latest: ReasoningEffort[] = [...modern, "max"];
// USD / 1M tokens, standard processing. Official model pages, checked 2026-10-02.
export const PRICE_CHECKED = "2026-10-02";
export const OPENAI_MODELS: OpenAiModel[] = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", input: 0.2, output: 1.2, efforts: latest, value: true },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", input: 2, output: 12, efforts: latest },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", input: 4, output: 20, efforts: latest },
  { id: "gpt-6-luna", label: "GPT-6 Luna", input: 0.1, output: 0.5, efforts: latest },
  { id: "gpt-6-sol", label: "GPT-6 Sol", input: 2, output: 10, efforts: latest },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", input: 2, output: 10, efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "gpt-6-astra", label: "GPT-6 Astra", input: 10, output: 50, efforts: ["low", "medium", "high", "xhigh", "max"] },
];
export const EFFORT_OUTPUT: Record<ReasoningEffort, number> = { none: 3000, minimal: 3500, low: 4500, medium: 6500, high: 10000, xhigh: 16000, max: 24000 };
export const modelInfo = (id: string) => OPENAI_MODELS.find(model => model.id === id);
type UsageSample = { model: string; reasoning_effort?: ReasoningEffort; parent_version_id?: number; ai_usage?: { output_tokens: number } };
export function historicalOutput(model: string, effort: ReasoningEffort, samples: UsageSample[]) {
  const outputs = samples.filter(sample => sample.model === model && sample.reasoning_effort === effort && !sample.parent_version_id && Number.isFinite(sample.ai_usage?.output_tokens) && sample.ai_usage!.output_tokens > 0).slice(0, 20).map(sample => sample.ai_usage!.output_tokens);
  if (outputs.length < 3) return EFFORT_OUTPUT[effort];
  outputs.sort((a, b) => a - b);
  const middle = Math.floor(outputs.length / 2);
  return outputs.length % 2 ? outputs[middle] : (outputs[middle - 1] + outputs[middle]) / 2;
}
export function defaultEffort(id: string): ReasoningEffort { return modelInfo(id)?.efforts.includes("low") ? "low" : "minimal"; }
// Local estimate only. The default JD is 700 English words, roughly 4,200 characters.
export function estimateInputTokens(text: string) {
  return Math.ceil(Array.from(text).reduce((total, character) => total + (character.codePointAt(0)! > 127 ? 1 : 0.25), 0)) + 1050;
}
export function scenarioCost(model: OpenAiModel, effort: ReasoningEffort, inputTokens: number, samples: UsageSample[] = []) {
  return (inputTokens * model.input + historicalOutput(model.id, effort, samples) * model.output) / 1e6;
}
export function priceLabel(model: OpenAiModel, effort = defaultEffort(model.id), inputTokens = 0, samples: UsageSample[] = []) {
  const cost = scenarioCost(model, effort, inputTokens, samples);
  return `${model.label} / ${effort} (est. $${cost.toFixed(4)})`;
}
