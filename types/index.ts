export type WorkAuthorization = "citizen" | "permanent_resident" | "visa_required";

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
};

export type ProfileCompletion = {
  percentage: number;
  missingFields: string[];
};
