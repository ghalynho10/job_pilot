"use client";

import { Plus, X } from "lucide-react";
import { useState, type JSX, type KeyboardEvent, type ReactNode } from "react";

import type {
  Education,
  ExperienceLevel,
  HighestDegree,
  Profile,
  RemotePreference,
  WorkAuthorization,
  WorkExperienceEntry,
} from "@/types";

interface ProfileFormProps {
  initialProfile: Profile;
}

const MAX_WORK_EXPERIENCE_ENTRIES = 3;

const WORK_AUTHORIZATION_OPTIONS: { value: WorkAuthorization; label: string }[] = [
  { value: "citizen", label: "Citizen" },
  { value: "permanent_resident", label: "Permanent Resident" },
  { value: "visa_required", label: "Visa Required" },
];

const EXPERIENCE_LEVEL_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
];

const HIGHEST_DEGREE_OPTIONS: { value: HighestDegree; label: string }[] = [
  { value: "high_school", label: "High School" },
  { value: "associate", label: "Associate Degree" },
  { value: "bachelor", label: "Bachelor's Degree" },
  { value: "master", label: "Master's Degree" },
  { value: "doctorate", label: "Doctorate" },
];

const REMOTE_PREFERENCE_OPTIONS: { value: RemotePreference; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "any", label: "Any" },
];

const labelClass = "text-xs font-medium uppercase tracking-wide text-text-secondary";
const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-secondary";

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }): JSX.Element {
  return (
    <h3 className="text-base font-semibold text-text-primary">{children}</h3>
  );
}

export function ProfileForm({ initialProfile }: ProfileFormProps): JSX.Element {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [skillInput, setSkillInput] = useState("");
  const [industryInput, setIndustryInput] = useState("");

  const updateField = <K extends keyof Profile>(key: K, value: Profile[K]): void => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const addSkill = (): void => {
    const value = skillInput.trim();
    if (value.length === 0 || profile.skills.includes(value)) return;
    updateField("skills", [...profile.skills, value]);
    setSkillInput("");
  };

  const removeSkill = (skill: string): void => {
    updateField(
      "skills",
      profile.skills.filter((item) => item !== skill),
    );
  };

  const addIndustry = (): void => {
    const value = industryInput.trim();
    if (value.length === 0 || profile.industries.includes(value)) return;
    updateField("industries", [...profile.industries, value]);
    setIndustryInput("");
  };

  const removeIndustry = (industry: string): void => {
    updateField(
      "industries",
      profile.industries.filter((item) => item !== industry),
    );
  };

  const handleTagKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    onAdd: () => void,
  ): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      onAdd();
    }
  };

  const updateWorkExperience = <K extends keyof WorkExperienceEntry>(
    index: number,
    key: K,
    value: WorkExperienceEntry[K],
  ): void => {
    updateField(
      "workExperience",
      profile.workExperience.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    );
  };

  const addWorkExperience = (): void => {
    if (profile.workExperience.length >= MAX_WORK_EXPERIENCE_ENTRIES) return;
    updateField("workExperience", [
      ...profile.workExperience,
      {
        company: "",
        jobTitle: "",
        startDate: "",
        endDate: "",
        currentlyWorkingHere: false,
        keyResponsibilities: "",
      },
    ]);
  };

  const updateEducation = <K extends keyof Education>(
    key: K,
    value: Education[K],
  ): void => {
    updateField("education", { ...profile.education, [key]: value });
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">
        Profile Information
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        This context is used to accurately represent you in agent
        interactions.
      </p>

      <div className="mt-6 space-y-6 border-t border-border pt-6">
        <SectionHeading>Personal Info</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField htmlFor="fullName" label="Full Name">
            <input
              className={inputClass}
              id="fullName"
              onChange={(event) => updateField("fullName", event.target.value)}
              type="text"
              value={profile.fullName}
            />
          </FormField>
          <FormField htmlFor="email" label="Email">
            <input
              className={inputClass}
              disabled
              id="email"
              type="email"
              value={profile.email}
            />
          </FormField>
          <FormField htmlFor="phone" label="Phone Number">
            <input
              className={inputClass}
              id="phone"
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="+1 (555) 000-0000"
              type="tel"
              value={profile.phone}
            />
          </FormField>
          <FormField htmlFor="location" label="Location">
            <input
              className={inputClass}
              id="location"
              onChange={(event) => updateField("location", event.target.value)}
              placeholder="City, Country"
              type="text"
              value={profile.location}
            />
          </FormField>
          <FormField htmlFor="linkedinUrl" label="LinkedIn URL">
            <input
              className={inputClass}
              id="linkedinUrl"
              onChange={(event) => updateField("linkedinUrl", event.target.value)}
              type="url"
              value={profile.linkedinUrl}
            />
          </FormField>
          <FormField htmlFor="portfolioUrl" label="Portfolio / GitHub">
            <input
              className={inputClass}
              id="portfolioUrl"
              onChange={(event) => updateField("portfolioUrl", event.target.value)}
              type="url"
              value={profile.portfolioUrl}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField htmlFor="workAuthorization" label="Work Authorization">
            <select
              className={inputClass}
              id="workAuthorization"
              onChange={(event) =>
                updateField(
                  "workAuthorization",
                  event.target.value as WorkAuthorization,
                )
              }
              value={profile.workAuthorization}
            >
              {WORK_AUTHORIZATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-border pt-6">
        <SectionHeading>Professional Info</SectionHeading>
        <FormField htmlFor="currentTitle" label="Current/Recent Job Title">
          <input
            className={inputClass}
            id="currentTitle"
            onChange={(event) => updateField("currentTitle", event.target.value)}
            type="text"
            value={profile.currentTitle}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField htmlFor="experienceLevel" label="Experience Level">
            <select
              className={inputClass}
              id="experienceLevel"
              onChange={(event) =>
                updateField("experienceLevel", event.target.value as ExperienceLevel)
              }
              value={profile.experienceLevel}
            >
              {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="yearsExperience" label="Years of Experience">
            <input
              className={inputClass}
              id="yearsExperience"
              min={0}
              onChange={(event) =>
                updateField(
                  "yearsExperience",
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              type="number"
              value={profile.yearsExperience}
            />
          </FormField>
        </div>

        <div>
          <label className={labelClass} htmlFor="skillInput">
            Skills
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              className={inputClass}
              id="skillInput"
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => handleTagKeyDown(event, addSkill)}
              placeholder="Add a skill"
              type="text"
              value={skillInput}
            />
            <button
              className="shrink-0 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={addSkill}
              type="button"
            >
              Add
            </button>
          </div>
          {profile.skills.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <li
                  className="flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-primary"
                  key={skill}
                >
                  {skill}
                  <button
                    aria-label={`Remove ${skill}`}
                    className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => removeSkill(skill)}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3 text-text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="industryInput">
            Industries Worked In (Optional)
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              className={inputClass}
              id="industryInput"
              onChange={(event) => setIndustryInput(event.target.value)}
              onKeyDown={(event) => handleTagKeyDown(event, addIndustry)}
              placeholder="E.g. FinTech, Healthcare"
              type="text"
              value={industryInput}
            />
            <button
              className="shrink-0 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={addIndustry}
              type="button"
            >
              Add
            </button>
          </div>
          {profile.industries.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {profile.industries.map((industry) => (
                <li
                  className="flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-primary"
                  key={industry}
                >
                  {industry}
                  <button
                    aria-label={`Remove ${industry}`}
                    className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => removeIndustry(industry)}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3 text-text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <SectionHeading>Work Experience</SectionHeading>
          <button
            className="flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-text-muted"
            disabled={profile.workExperience.length >= MAX_WORK_EXPERIENCE_ENTRIES}
            onClick={addWorkExperience}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add role
          </button>
        </div>
        {profile.workExperience.map((entry, index) => (
          <div
            className="space-y-4 rounded-lg border border-border bg-surface-secondary p-4"
            key={index}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField htmlFor={`company-${index}`} label="Company Name">
                <input
                  className={inputClass}
                  id={`company-${index}`}
                  onChange={(event) =>
                    updateWorkExperience(index, "company", event.target.value)
                  }
                  type="text"
                  value={entry.company}
                />
              </FormField>
              <FormField htmlFor={`jobTitle-${index}`} label="Job Title">
                <input
                  className={inputClass}
                  id={`jobTitle-${index}`}
                  onChange={(event) =>
                    updateWorkExperience(index, "jobTitle", event.target.value)
                  }
                  type="text"
                  value={entry.jobTitle}
                />
              </FormField>
              <FormField htmlFor={`startDate-${index}`} label="Start Date">
                <input
                  className={inputClass}
                  id={`startDate-${index}`}
                  onChange={(event) =>
                    updateWorkExperience(index, "startDate", event.target.value)
                  }
                  type="month"
                  value={entry.startDate}
                />
              </FormField>
              <div>
                <div className="flex items-center justify-between">
                  <label className={labelClass} htmlFor={`endDate-${index}`}>
                    End Date
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <input
                      checked={entry.currentlyWorkingHere}
                      className="rounded border-border text-accent focus:ring-accent"
                      onChange={(event) =>
                        updateWorkExperience(
                          index,
                          "currentlyWorkingHere",
                          event.target.checked,
                        )
                      }
                      type="checkbox"
                    />
                    Currently working here
                  </label>
                </div>
                <div className="mt-1.5">
                  <input
                    className={inputClass}
                    disabled={entry.currentlyWorkingHere}
                    id={`endDate-${index}`}
                    onChange={(event) =>
                      updateWorkExperience(index, "endDate", event.target.value)
                    }
                    type="month"
                    value={entry.endDate}
                  />
                </div>
              </div>
            </div>
            <FormField
              htmlFor={`responsibilities-${index}`}
              label="Key Responsibilities"
            >
              <textarea
                className={inputClass}
                id={`responsibilities-${index}`}
                onChange={(event) =>
                  updateWorkExperience(
                    index,
                    "keyResponsibilities",
                    event.target.value,
                  )
                }
                rows={3}
                value={entry.keyResponsibilities}
              />
            </FormField>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-4 border-t border-border pt-6">
        <SectionHeading>Education</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField htmlFor="highestDegree" label="Highest Degree">
            <select
              className={inputClass}
              id="highestDegree"
              onChange={(event) =>
                updateEducation("highestDegree", event.target.value as HighestDegree)
              }
              value={profile.education.highestDegree}
            >
              {HIGHEST_DEGREE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="fieldOfStudy" label="Field of Study">
            <input
              className={inputClass}
              id="fieldOfStudy"
              onChange={(event) => updateEducation("fieldOfStudy", event.target.value)}
              type="text"
              value={profile.education.fieldOfStudy}
            />
          </FormField>
          <FormField htmlFor="institutionName" label="Institution Name">
            <input
              className={inputClass}
              id="institutionName"
              onChange={(event) =>
                updateEducation("institutionName", event.target.value)
              }
              placeholder="E.g. State University"
              type="text"
              value={profile.education.institutionName}
            />
          </FormField>
          <FormField htmlFor="graduationYear" label="Graduation Year">
            <input
              className={inputClass}
              id="graduationYear"
              onChange={(event) =>
                updateEducation("graduationYear", event.target.value)
              }
              placeholder="YYYY"
              type="text"
              value={profile.education.graduationYear}
            />
          </FormField>
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-border pt-6">
        <SectionHeading>Job Preferences</SectionHeading>
        <FormField htmlFor="jobTitlesSeeking" label="Job Titles Seeking">
          <input
            className={inputClass}
            id="jobTitlesSeeking"
            onChange={(event) =>
              updateField("jobTitlesSeeking", event.target.value)
            }
            type="text"
            value={profile.jobTitlesSeeking}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField htmlFor="remotePreference" label="Remote Preference">
            <select
              className={inputClass}
              id="remotePreference"
              onChange={(event) =>
                updateField("remotePreference", event.target.value as RemotePreference)
              }
              value={profile.remotePreference}
            >
              {REMOTE_PREFERENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            htmlFor="salaryExpectation"
            label="Salary Expectation (Optional)"
          >
            <input
              className={inputClass}
              id="salaryExpectation"
              onChange={(event) =>
                updateField("salaryExpectation", event.target.value)
              }
              placeholder="E.g. $120k+"
              type="text"
              value={profile.salaryExpectation}
            />
          </FormField>
        </div>
        <FormField
          htmlFor="preferredLocations"
          label="Preferred Locations (Optional)"
        >
          <input
            className={inputClass}
            id="preferredLocations"
            onChange={(event) =>
              updateField("preferredLocations", event.target.value)
            }
            placeholder="E.g. New York, London"
            type="text"
            value={profile.preferredLocations}
          />
        </FormField>
      </div>

      <button
        className="mt-8 w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        type="button"
      >
        Save Profile
      </button>
    </section>
  );
}
