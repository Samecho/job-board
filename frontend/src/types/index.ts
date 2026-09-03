export type CompanyStatus = "Not Applied" | "Applied";
export type ApplicationStage = "Applied" | "OA" | "Interview" | "Rejected" | "Offer";
export type AiProvider = "openai" | "gemini" | "glm";

export interface CompanyCatalogItem {
  id: number;
  name: string;
  display_name: string | null;
  domain: string;
  logo_url: string | null;
  career_url: string;
  tier: string;
  category: string;
  main_locations: string;
  intern_friendly: boolean;
  link: string;
}

export interface Company extends CompanyCatalogItem {
  status: CompanyStatus;
  notes: string;
  resume_count: number;
  application_count: number;
}

export interface CompanyUpdate {
  notes?: string;
  link?: string;
  main_locations?: string;
}

export interface CompanyState {
  company_id: number;
  notes: string;
  link: string;
  main_locations: string;
  updated_at: string;
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
  research_text: string;
  skills_text: string;
  awards_text: string;
  other_text: string;
  updated_at: string;
}

export type ResumeProfileUpdate = Omit<ResumeProfile, "id" | "updated_at">;

export interface AiSettings {
  provider: AiProvider;
  api_key: string;
  model: string;
  updated_at: string;
}

export interface Application {
  id: number;
  company_id: number;
  job_title: string;
  job_description: string;
  application_stage: ApplicationStage;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeSectionItem {
  title: string;
  subtitle?: string;
  location?: string;
  dates?: string;
  bullets: string[];
}

export interface StructuredResume {
  header: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  education: ResumeSectionItem[];
  experience: ResumeSectionItem[];
  projects: ResumeSectionItem[];
  skills: string[];
  confirmation_needed?: string[];
}

export interface ResumeVersion {
  id: number;
  application_id: number;
  company_id: number;
  version_number: number;
  structured_resume: StructuredResume;
  pdf_file: Blob;
  docx_file: Blob;
  provider: string;
  model: string;
  created_at: string;
}

export interface ResumeVersionRead {
  id: number;
  application_id: number;
  company_id: number;
  company_name: string;
  job_title: string;
  version_number: number;
  structured_resume: StructuredResume;
  provider: string;
  model: string;
  created_at: string;
}

export interface GeneratedResume extends ResumeVersionRead {
  resume_name: string;
  jd_text: string;
  generated_latex: string;
  notes: string;
  updated_at: string;
}

export interface Analytics {
  total_companies: number;
  applied_count: number;
  total_applications: number;
  applications_by_stage: Record<ApplicationStage, number>;
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
