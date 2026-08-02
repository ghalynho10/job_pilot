export type WorkAuthorization =
  | "citizen"
  | "permanent_resident"
  | "visa_required";

export type ExperienceLevel = "junior" | "mid" | "senior" | "lead";

export type RemotePreference = "remote" | "onsite" | "hybrid" | "any";

export type HighestDegree =
  | "high_school"
  | "associate"
  | "bachelor"
  | "master"
  | "doctorate";

export type WorkExperienceEntry = {
  company: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  currentlyWorkingHere: boolean;
  keyResponsibilities: string;
};

export type Education = {
  highestDegree: HighestDegree | "";
  fieldOfStudy: string;
  institutionName: string;
  graduationYear: string;
};

export type Project = {
  name: string;
  description?: string;
  url?: string;
  technologies?: string[];
};

export type Profile = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workAuthorization: WorkAuthorization | "";
  currentTitle: string;
  experienceLevel: ExperienceLevel | "";
  yearsExperience: number | "";
  skills: string[];
  industries: string[];
  workExperience: WorkExperienceEntry[];
  education: Education;
  jobTitlesSeeking: string;
  remotePreference: RemotePreference | "";
  salaryExpectation: string;
  preferredLocations: string;
  projects: Project[] | null;
};

export type ProfileCompletion = {
  percentage: number;
  missingFields: string[];
};

export type ProfileCompletionInput = {
  fullName: string;
  phone: string;
  location: string;
  currentTitle: string;
  experienceLevel: string;
  yearsExperience: number | null;
  skills: string[];
  workExperience: WorkExperienceEntry[];
  education: Education;
  jobTitlesSeeking: string[];
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  experience_level: string | null;
  years_experience: number | null;
  skills: string[] | null;
  industries: string[] | null;
  work_experience: WorkExperienceEntry[] | null;
  education: Education | null;
  job_titles_seeking: string[] | null;
  remote_preference: string | null;
  preferred_locations: string[] | null;
  salary_expectation: string | null;
  cover_letter_tone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  work_authorization: string | null;
  resume_pdf_url: string | null;
  projects: Project[] | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileWritePayload = Omit<
  ProfileRow,
  "created_at" | "updated_at" | "cover_letter_tone" | "resume_pdf_url"
> & {
  resume_pdf_url?: string;
};

export type ActionResult<T = Record<string, never>> =
  | ({ success: true } & T)
  | { success: false; error: string };

export type ExtractedProfileFields = Pick<
  Profile,
  | "fullName"
  | "phone"
  | "location"
  | "linkedinUrl"
  | "portfolioUrl"
  | "workAuthorization"
  | "currentTitle"
  | "experienceLevel"
  | "yearsExperience"
  | "skills"
  | "industries"
  | "workExperience"
  | "education"
  | "projects"
>;

export type GeneratedResumeContent = {
  summary: string;
  workExperienceBullets: string[][];
};

export type JobMatch = {
  matchScore: number;
  matchReason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

export type CompanyResearchDossier = {
  companyOverview: string;
  techStack: string[];
  culture: string[];
  whyThisRole: string;
  yourEdge: string[];
  gapsToAddress: string[];
  smartQuestions: string[];
  interviewPrep: string[];
  sources: string[];
};

export type AgentRunRow = {
  id: string;
  user_id: string;
  status: "running" | "completed" | "failed";
  job_title_searched: string | null;
  location_searched: string | null;
  jobs_found: number | null;
  started_at: string;
  completed_at: string | null;
};

export type JobRow = {
  id: string;
  run_id: string | null;
  user_id: string;
  source: "search" | "url";
  source_url: string | null;
  external_id: string | null;
  external_apply_url: string | null;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  about_role: string | null;
  responsibilities: string[] | null;
  requirements: string[] | null;
  nice_to_have: string[] | null;
  benefits: string[] | null;
  about_company: string | null;
  match_score: number | null;
  match_reason: string | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  company_research: CompanyResearchDossier | null;
  company_research_completed_at: string | null;
  found_at: string;
};

export type UserAccessStatus = "pending" | "approved" | "blocked";

export type UserAccessRow = {
  user_id: string;
  status: UserAccessStatus;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
};

export type SubscriptionRow = {
  user_id: string;
  plan: "free" | "pro";
  status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "unpaid"
    | "paused";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  research_runs_used: number;
  usage_period_start: string;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  plan: SubscriptionRow["plan"];
  status: SubscriptionRow["status"];
  researchRunsUsed: number;
  usagePeriodStart: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};
