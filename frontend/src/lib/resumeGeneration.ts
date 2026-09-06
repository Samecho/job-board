export type GenerationTask = {
  companyId: number;
  companyName: string;
  applicationId?: number;
  status: "running" | "completed" | "failed";
  error?: string;
};

let tasks: GenerationTask[] = [];
const listeners = new Set<() => void>();
export const getGenerationTasks = () => tasks;
export const subscribeGeneration = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
function publish(task: GenerationTask) {
  tasks = [...tasks.filter(item => item.companyId !== task.companyId), task];
  listeners.forEach(listener => listener());
}
export function dismissGeneration(companyId: number) {
  tasks = tasks.filter(task => task.companyId !== companyId || task.status === "running");
  listeners.forEach(listener => listener());
}

// The operation and its status outlive the modal, but not a browser reload.
export async function runResumeGeneration(
  company: { id: number; name: string },
  prepare: () => Promise<number>,
  generate: (applicationId: number) => Promise<unknown>,
) {
  if (tasks.some(task => task.companyId === company.id && task.status === "running")) return;
  let task: GenerationTask = { companyId: company.id, companyName: company.name, status: "running" };
  publish(task);
  try {
    const applicationId = await prepare();
    task = { ...task, applicationId };
    publish(task);
    await generate(applicationId);
    publish({ ...task, status: "completed" });
  } catch (reason) {
    publish({ ...task, status: "failed", error: reason instanceof Error ? reason.message : "Generation failed" });
  }
}
