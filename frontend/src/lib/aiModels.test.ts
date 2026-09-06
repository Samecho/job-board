import { expect, it } from "vitest";
import { OPENAI_MODELS, budgetPlan, scenarioCost } from "./aiModels";

const date = new Date("2026-09-06T12:00:00Z");
it("caps every accepted model/effort combination, including reasoning tokens", () => {
  let accepted = 0;
  for (const model of OPENAI_MODELS) for (const effort of model.efforts) for (const input of [0, 1000, 6000, 20000, 50000]) {
    try {
      const plan = budgetPlan(model.id, effort, input, date);
      accepted++;
      expect(plan.upperBoundUsd).toBeLessThanOrEqual(0.045);
      expect((input * model.input + plan.maxOutputTokens * model.output) / 1e6).toBeLessThan(0.05);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("cannot fit")) throw error;
    }
  }
  expect(accepted).toBeGreaterThan(30);
});

it("rejects unknown models, invalid efforts, stale pricing and bad counts", () => {
  expect(() => budgetPlan("gpt-fake", "low", 1000, date)).toThrow();
  expect(() => budgetPlan("gpt-6-astra", "none", 1000, date)).toThrow();
  expect(() => budgetPlan("gpt-5.6-luna", "low", NaN, date)).toThrow();
  expect(() => budgetPlan("gpt-5.6-luna", "low", 50001, date)).toThrow();
  expect(() => budgetPlan("gpt-5.6-luna", "low", 1000, new Date("2027-01-01"))).toThrow("expired");
});

it("labels comparable scenarios without pretending effort is a fixed token price", () => {
  const luna = OPENAI_MODELS.find(model => model.id === "gpt-5.6-luna")!;
  expect(scenarioCost(luna, "low")).toBeCloseTo(0.0066);
  expect(scenarioCost(luna, "max")).toBeGreaterThan(scenarioCost(luna, "low"));
  expect(() => budgetPlan("gpt-6-astra", "low", 6000, date)).toThrow("cannot fit");
});

it("offers only the requested 5.6 and 6 models", () => {
  expect(OPENAI_MODELS.map(model => model.id)).toEqual([
    "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-6-astra",
  ]);
});
