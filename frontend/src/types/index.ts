export type ApplicationStatus =
  | "Not Applied" | "Watching" | "Interested" | "Applied" | "OA"
  | "Interview" | "Rejected" | "Offer" | "Hidden";

export interface Company {
  id: number;
  name: string;
  domain: string;
  logo_url: string | null;
  tier: "S+" | "S" | "A+" | "A" | "B+" | "B" | "C+" | "C" | "D+" | "D";
  category: string;
  career_url: string;
  main_locations: string;
  intern_open_count: number;
  is_intern_hiring: boolean;
  average_intern_pay_min: number | null;
  average_intern_pay_max: number | null;
  pay_currency: string;
  pay_period: string;
  match_score: number;
  application_status: ApplicationStatus;
  notes: string;
  tags: string;
  last_updated: string;
}

export interface Job {
  id: number;
  company_id: number;
  company_name: string;
  company_match_score: number;
  title: string;
  location: string;
  job_type: string;
  apply_url: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  pay_period: string;
  status: string;
  deadline: string | null;
  notes: string;
  date_added: string;
  is_active: boolean;
}

export interface Summary {
  total_companies: number;
  companies_hiring: number;
  total_open_roles: number;
  applied_count: number;
  interview_count: number;
  offer_count: number;
  average_match_score: number;
  priority_companies: Company[];
  status_counts: Record<string, number>;
  category_counts: Record<string, number>;
  tier_counts: Record<string, number>;
}

export type CompanyUpdate = Partial<Omit<Company, "id" | "last_updated">>;
export type JobCreate = Omit<Job, "id" | "company_name" | "company_match_score" | "date_added">;
