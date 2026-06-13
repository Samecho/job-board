import type {
  Analytics, Company, CompanyUpdate, FeatureStatus, GeneratedResume,
  ResumeProfile, ResumeProfileUpdate, ResumeSave,
} from "../types";

const backend = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const API = `${backend}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
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
  company: (id: number) => request<Company>(`/companies/${id}`),
  updateCompany: (id: number, data: CompanyUpdate) =>
    request<Company>(`/companies/${id}`, {
      method: "PUT", body: JSON.stringify(data),
    }),
  analytics: () => request<Analytics>("/analytics/summary"),
  profile: () => request<ResumeProfile>("/resume-profile"),
  updateProfile: (data: ResumeProfileUpdate) =>
    request<ResumeProfile>("/resume-profile", {
      method: "PUT", body: JSON.stringify(data),
    }),
  features: () => request<FeatureStatus>("/features"),
  generateResume: (data: {
    company_id: number;
    job_title: string;
    jd_text: string;
    extra_instructions: string;
  }) => request<{
    generated_latex: string;
    suggested_resume_name: string;
    warnings: string[];
  }>("/resumes/generate", { method: "POST", body: JSON.stringify(data) }),
  resumes: () => request<GeneratedResume[]>("/resumes"),
  companyResumes: (companyId: number) =>
    request<GeneratedResume[]>(`/companies/${companyId}/resumes`),
  saveResume: (companyId: number, data: ResumeSave) =>
    request<GeneratedResume>(`/companies/${companyId}/resumes`, {
      method: "POST", body: JSON.stringify(data),
    }),
  updateResume: (id: number, data: Partial<ResumeSave>) =>
    request<GeneratedResume>(`/resumes/${id}`, {
      method: "PUT", body: JSON.stringify(data),
    }),
  deleteResume: (id: number) =>
    request<void>(`/resumes/${id}`, { method: "DELETE" }),
};
