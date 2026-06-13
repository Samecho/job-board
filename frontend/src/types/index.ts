export type CompanyStatus = "Not Applied" | "Applied";

export interface Company {
  id: number;
  name: string;
  display_name: string | null;
  domain: string;
  logo_url: string | null;
  career_url: string;
  tier: string;
  category: string;
  main_locations: string;
  status: CompanyStatus;
  notes: string;
  link: string;
  resume_count: number;
}

export interface CompanyUpdate {
  status?: CompanyStatus;
  notes?: string;
  link?: string;
  main_locations?: string;
}

export interface ResumeProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  education_text: string;
  experience_text: string;
  projects_text: string;
  skills_text: string;
  awards_text: string;
  other_text: string;
  updated_at: string;
}

export type ResumeProfileUpdate = Omit<ResumeProfile, "id" | "updated_at">;

export interface GeneratedResume {
  id: number;
  company_id: number;
  company_name: string;
  job_title: string;
  jd_text: string;
  generated_latex: string;
  resume_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeSave {
  job_title: string;
  jd_text: string;
  generated_latex: string;
  resume_name: string;
  notes: string;
}

export interface Analytics {
  total_companies: number;
  applied_count: number;
  status_counts: Record<string, number>;
  tier_counts: Record<string, number>;
  saved_resume_count: number;
  companies_with_resumes: number;
  recent_resumes: Array<{
    id: number;
    company_id: number;
    company_name: string;
    resume_name: string;
    job_title: string;
    created_at: string;
  }>;
}

export interface FeatureStatus {
  ai_enabled: boolean;
  ai_configured: boolean;
}
