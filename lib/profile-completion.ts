import type { ProfileCompletion, ProfileCompletionInput } from "@/types";

const CHECKS: {
  label: string;
  passes: (input: ProfileCompletionInput) => boolean;
}[] = [
  { label: "Full Name", passes: (input) => input.fullName.trim().length > 0 },
  { label: "Phone", passes: (input) => input.phone.trim().length > 0 },
  { label: "Location", passes: (input) => input.location.trim().length > 0 },
  {
    label: "Current Title",
    passes: (input) => input.currentTitle.trim().length > 0,
  },
  {
    label: "Experience Level",
    passes: (input) => input.experienceLevel !== "",
  },
  {
    label: "Years of Experience",
    passes: (input) => input.yearsExperience !== null,
  },
  { label: "Skills", passes: (input) => input.skills.length > 0 },
  {
    label: "Work Experience",
    passes: (input) => input.workExperience.length > 0,
  },
  {
    label: "Education",
    passes: (input) => input.education.highestDegree !== "",
  },
  {
    label: "Job Titles Seeking",
    passes: (input) => input.jobTitlesSeeking.length > 0,
  },
];

export function deriveProfileCompletion(
  input: ProfileCompletionInput,
): ProfileCompletion {
  const missingFields = CHECKS.filter((check) => !check.passes(input)).map(
    (check) => check.label,
  );
  const percentage = Math.round(
    ((CHECKS.length - missingFields.length) / CHECKS.length) * 100,
  );

  return { percentage, missingFields };
}

export function isProfileComplete(input: ProfileCompletionInput): boolean {
  return CHECKS.every((check) => check.passes(input));
}
