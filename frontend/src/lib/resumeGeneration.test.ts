import { expect, it, vi } from "vitest";
import { dismissGeneration, getGenerationTasks, runResumeGeneration, subscribeGeneration } from "./resumeGeneration";

it("survives unsubscription and blocks duplicate work", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const generate = vi.fn(() => pending);
  const unsubscribe = subscribeGeneration(() => {});
  const operation = runResumeGeneration({ id: 90001, name: "Example" }, async () => 101, generate);
  await Promise.resolve();
  unsubscribe();
  expect(getGenerationTasks()[0]).toMatchObject({ status: "running", applicationId: 101 });
  await runResumeGeneration({ id: 90001, name: "Example" }, async () => 101, generate);
  expect(generate).toHaveBeenCalledTimes(1);
  release();
  await operation;
  expect(getGenerationTasks()[0].status).toBe("completed");
  dismissGeneration(90001);
});

it("retains errors and allows retry", async () => {
  await runResumeGeneration({ id: 90002, name: "Example" }, async () => 102, async () => { throw new Error("Provider unavailable"); });
  expect(getGenerationTasks()[0]).toMatchObject({ status: "failed", error: "Provider unavailable" });
  await runResumeGeneration({ id: 90002, name: "Example" }, async () => 102, async () => {});
  expect(getGenerationTasks()[0].status).toBe("completed");
  expect(getGenerationTasks()[0].error).toBeUndefined();
  dismissGeneration(90002);
});
