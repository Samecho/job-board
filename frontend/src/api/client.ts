import type { Company, CompanyUpdate, Job, JobCreate, Summary } from "../types";

const API = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  companies: () => request<Company[]>("/companies"),
  updateCompany: (id: number, data: CompanyUpdate) =>
    request<Company>(`/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  jobs: () => request<Job[]>("/jobs"),
  createJob: (data: JobCreate) =>
    request<Job>("/jobs", { method: "POST", body: JSON.stringify(data) }),
  updateJob: (id: number, data: Partial<JobCreate>) =>
    request<Job>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteJob: (id: number) => request<void>(`/jobs/${id}`, { method: "DELETE" }),
  summary: () => request<Summary>("/analytics/summary"),
  reset: () => request<{ message: string }>("/seed/reset", { method: "POST" }),
};
