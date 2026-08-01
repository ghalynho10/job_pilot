import OpenAI from "openai";
import { z } from "zod";

import type { ExtractedProfileFields } from "@/types";

const WORK_AUTHORIZATION_VALUES = [
  "citizen",
  "permanent_resident",
  "visa_required",
] as const;
const EXPERIENCE_LEVEL_VALUES = ["junior", "mid", "senior", "lead"] as const;
const HIGHEST_DEGREE_VALUES = [
  "high_school",
  "associate",
  "bachelor",
  "master",
  "doctorate",
] as const;

const workAuthorizationSchema = z
  .enum([...WORK_AUTHORIZATION_VALUES, ""])
  .catch("");
const experienceLevelSchema = z
  .enum([...EXPERIENCE_LEVEL_VALUES, ""])
  .catch("");
const highestDegreeSchema = z.enum([...HIGHEST_DEGREE_VALUES, ""]).catch("");

const workExperienceEntrySchema = z.object({
  company: z.string().catch(""),
  jobTitle: z.string().catch(""),
  startDate: z.string().catch(""),
  endDate: z.string().catch(""),
  currentlyWorkingHere: z.boolean().catch(false),
  keyResponsibilities: z.string().catch(""),
});

const educationSchema = z.object({
  highestDegree: highestDegreeSchema,
  fieldOfStudy: z.string().catch(""),
  institutionName: z.string().catch(""),
  graduationYear: z.string().catch(""),
});

const projectSchema = z.object({
  name: z.string().catch(""),
  description: z.string().catch("").optional(),
  url: z.string().catch("").optional(),
  technologies: z.array(z.string()).catch([]).optional(),
});

export const extractedProfileSchema = z.object({
  fullName: z.string().catch(""),
  phone: z.string().catch(""),
  location: z.string().catch(""),
  linkedinUrl: z.string().catch(""),
  portfolioUrl: z.string().catch(""),
  workAuthorization: workAuthorizationSchema,
  currentTitle: z.string().catch(""),
  experienceLevel: experienceLevelSchema,
  yearsExperience: z.union([z.number(), z.literal("")]).catch(""),
  skills: z.array(z.string()).catch([]),
  industries: z.array(z.string()).catch([]),
  workExperience: z
    .array(workExperienceEntrySchema)
    .catch([])
    .transform((entries) => entries.slice(0, 3)),
  education: educationSchema.catch({
    highestDegree: "",
    fieldOfStudy: "",
    institutionName: "",
    graduationYear: "",
  }),
  projects: z
    .array(projectSchema)
    .catch([])
    .transform((p) => p.filter((p) => p.name.length > 0).slice(0, 5)),
}) satisfies z.ZodType<ExtractedProfileFields>;

const SYSTEM_PROMPT = `You are a precise resume parser. Read the resume text and extract only what is explicitly stated. Never invent, guess, or infer facts that are not in the text.

Rules:
- Return "" (empty string) or [] (empty array) for anything not stated in the text. Never fabricate.
- workAuthorization must be exactly one of "citizen", "permanent_resident", "visa_required", or "" if unclear.
- experienceLevel must be exactly one of "junior", "mid", "senior", "lead", or "" if unclear.
- education.highestDegree must be exactly one of "high_school", "associate", "bachelor", "master", "doctorate", or "" if unclear.
- workExperience holds at most the 3 most recent or most relevant roles, most recent first.
- projects holds at most 5 personal or portfolio projects listed on the resume, if any. Each project must have a "name" (required). "url" is optional and only included when the resume explicitly states it. "description" must combine the project's summary line AND every bullet point listed under it into one string, with each bullet point on its own line separated by "\\n" (a newline), matching the line-per-bullet layout in the resume, not just the first line and not joined into one sentence, so no detail listed under the project is dropped. "technologies" must list every specific language, framework, library, tool, or platform named anywhere in the project's text (summary line, bullets, or a trailing tech list), whether or not it is introduced with a label like "Technologies:" or "Built with"; do not require a label to recognize it, and do not omit a technology from "technologies" just because it also appears in "description". Return [] (empty array) if the resume has no projects section.
- Never include any job preference fields (desired titles, remote preference, salary, preferred locations) and never include an email field; there is no field for them in the response.

Return ONLY valid JSON matching this shape:
{
  "fullName": string,
  "phone": string,
  "location": string,
  "linkedinUrl": string,
  "portfolioUrl": string,
  "workAuthorization": string,
  "currentTitle": string,
  "experienceLevel": string,
  "yearsExperience": number or "",
  "skills": string[],
  "industries": string[],
  "workExperience": [{ "company": string, "jobTitle": string, "startDate": string, "endDate": string, "currentlyWorkingHere": boolean, "keyResponsibilities": string }],
  "education": { "highestDegree": string, "fieldOfStudy": string, "institutionName": string, "graduationYear": string },
  "projects": [{ "name": string, "description"?: string, "url"?: string, "technologies"?: string[] }]
}`;

export async function extractProfileFromResumeText(
  text: string,
): Promise<
  | { success: true; data: ExtractedProfileFields }
  | { success: false; error: string }
> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });

    const rawContent = response.choices[0]?.message.content;
    if (!rawContent) {
      return {
        success: false,
        error: "Extraction returned no content. Please try again.",
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("[agent/resume-extractor]", parseError);
      return {
        success: false,
        error: "Extraction returned an unreadable response. Please try again.",
      };
    }

    const validated = extractedProfileSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("[agent/resume-extractor]", validated.error);
      return {
        success: false,
        error: "Extraction returned an unexpected response. Please try again.",
      };
    }

    return { success: true, data: validated.data };
  } catch (error) {
    console.error("[agent/resume-extractor]", error);
    return {
      success: false,
      error: "Something went wrong extracting your profile. Please try again.",
    };
  }
}
