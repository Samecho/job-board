import { expect, it } from "vitest";
import { OPENAI_MODELS, estimateInputTokens, scenarioCost } from "./aiModels";

it("updates estimates with source length and includes a 700-word JD allowance", () => {
  const luna = OPENAI_MODELS[0];
  const short = estimateInputTokens("a".repeat(500));
  const long = estimateInputTokens("a".repeat(10000));
  expect(short).toBe(1175);
  expect(long).toBe(3550);
  expect(scenarioCost(luna, "max", long)).toBeGreaterThan(scenarioCost(luna, "max", short));
  expect(estimateInputTokens("中".repeat(500))).toBeGreaterThan(short);
});

it("offers only the requested models and permits estimates above five cents", () => {
  expect(OPENAI_MODELS.map(model => model.id)).toEqual(["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-6-astra"]);
  expect(scenarioCost(OPENAI_MODELS[3], "max", 6000)).toBeGreaterThan(0.05);
});
