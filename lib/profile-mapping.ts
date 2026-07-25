import type {
  ExperienceLevel,
  Profile,
  ProfileRow,
  ProfileWritePayload,
  RemotePreference,
  WorkAuthorization,
} from "@/types";

function toNullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function dedupeTrimmedList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

export function mapProfileToRow(
  profile: Profile,
  userId: string,
  email: string,
): Omit<ProfileWritePayload, "is_complete" | "resume_pdf_url"> {
  const years =
    profile.yearsExperience === "" ? null : Math.trunc(profile.yearsExperience);

  return {
    id: userId,
    email,
    full_name: toNullableTrimmed(profile.fullName),
    phone: toNullableTrimmed(profile.phone),
    location: toNullableTrimmed(profile.location),
    current_title: toNullableTrimmed(profile.currentTitle),
    experience_level: profile.experienceLevel === "" ? null : profile.experienceLevel,
    years_experience: years === null || years < 0 ? null : years,
    skills: dedupeTrimmedList(profile.skills),
    industries: dedupeTrimmedList(profile.industries),
    work_experience: profile.workExperience,
    education: profile.education,
    job_titles_seeking: splitCommaList(profile.jobTitlesSeeking),
    remote_preference: profile.remotePreference === "" ? null : profile.remotePreference,
    preferred_locations: splitCommaList(profile.preferredLocations),
    salary_expectation: toNullableTrimmed(profile.salaryExpectation),
    linkedin_url: toNullableTrimmed(profile.linkedinUrl),
    portfolio_url: toNullableTrimmed(profile.portfolioUrl),
    work_authorization: profile.workAuthorization === "" ? null : profile.workAuthorization,
  };
}

export function mapProfileRowToProfile(row: ProfileRow): Profile {
  return {
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    linkedinUrl: row.linkedin_url ?? "",
    portfolioUrl: row.portfolio_url ?? "",
    // The DB column has no CHECK constraint; this app only ever writes values
    // from these unions via mapProfileToRow, so the cast is safe.
    workAuthorization: (row.work_authorization as WorkAuthorization | null) ?? "",
    currentTitle: row.current_title ?? "",
    experienceLevel: (row.experience_level as ExperienceLevel | null) ?? "",
    yearsExperience: row.years_experience ?? "",
    skills: row.skills ?? [],
    industries: row.industries ?? [],
    workExperience: row.work_experience ?? [],
    education: row.education ?? {
      highestDegree: "",
      fieldOfStudy: "",
      institutionName: "",
      graduationYear: "",
    },
    jobTitlesSeeking: (row.job_titles_seeking ?? []).join(", "),
    remotePreference: (row.remote_preference as RemotePreference | null) ?? "",
    salaryExpectation: row.salary_expectation ?? "",
    preferredLocations: (row.preferred_locations ?? []).join(", "),
  };
}

export function buildEmptyProfile(email: string): Profile {
  return {
    fullName: "",
    email,
    phone: "",
    location: "",
    linkedinUrl: "",
    portfolioUrl: "",
    workAuthorization: "",
    currentTitle: "",
    experienceLevel: "",
    yearsExperience: "",
    skills: [],
    industries: [],
    workExperience: [],
    education: {
      highestDegree: "",
      fieldOfStudy: "",
      institutionName: "",
      graduationYear: "",
    },
    jobTitlesSeeking: "",
    remotePreference: "",
    salaryExpectation: "",
    preferredLocations: "",
  };
}
