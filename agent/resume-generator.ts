import OpenAI from "openai";
import { z } from "zod";

import type { GeneratedResumeContent, Profile } from "@/types";

const MAX_BULLETS_PER_ROLE = 6;
// Defense in depth: the profile form itself caps work experience at 3 entries,
// but this function reads straight from the DB row, so it re-enforces the same
// cap rather than trusting an upstream guarantee. Keeps the prompt (and the
// response it demands back) bounded, so a profile with many roles can't
// truncate the JSON mid-output under the fixed max_tokens budget below.
const MAX_WORK_EXPERIENCE_ENTRIES = 3;

const generatedResumeSchema = z.object({
  summary: z.string().catch(""),
  workExperienceBullets: z.array(z.array(z.string()).catch([])).catch([]),
}) satisfies z.ZodType<GeneratedResumeContent>;

const SYSTEM_PROMPT = `You are a professional resume writer. You only rephrase and elevate the language of what is given to you. Never invent employers, titles, dates, or accomplishments not present in the input.

Rules:
- Write a single paragraph professional summary, 3 to 4 sentences, referencing the person's current title, experience level or years of experience, and top skills or industries.
- Bullets start with a strong action verb in past or present tense as appropriate, never use "I" or other personal pronouns.
- Only quantify with numbers already present in the input, never invent a metric.
- Avoid cliches such as "team player" or "hard worker".
- Keep the whole response short enough to fit on one page: a short summary, and a small number of tight bullets per role.

Return ONLY valid JSON matching this shape:
{
  "summary": string,
  "workExperienceBullets": [string[], ...]
}
"workExperienceBullets" must have exactly one entry per work experience item given to you, in the same order, indexed 0 to N minus 1.`;

function buildUserMessage(profile: Profile): string {
  return JSON.stringify({
    fullName: profile.fullName,
    currentTitle: profile.currentTitle,
    experienceLevel: profile.experienceLevel,
    yearsExperience: profile.yearsExperience,
    skills: profile.skills,
    industries: profile.industries,
    education: profile.education,
    workExperience: profile.workExperience.slice(0, MAX_WORK_EXPERIENCE_ENTRIES).map((entry, index) => ({
      index,
      company: entry.company,
      jobTitle: entry.jobTitle,
      startDate: entry.startDate,
      endDate: entry.endDate,
      currentlyWorkingHere: entry.currentlyWorkingHere,
      keyResponsibilities: entry.keyResponsibilities,
    })),
  });
}

function splitIntoLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function reconcileBullets(
  profile: Profile,
  generatedBullets: string[][],
): string[][] {
  return profile.workExperience.slice(0, MAX_WORK_EXPERIENCE_ENTRIES).map((entry, index) => {
    const generated = generatedBullets[index];
    if (Array.isArray(generated) && generated.length > 0) {
      return generated.slice(0, MAX_BULLETS_PER_ROLE);
    }
    // The model dropped or reordered this index; fall back to the entry's own
    // notes so a role is never rendered empty and nothing is fabricated. Capped
    // the same as the model path, so the fallback can't overflow the one page
    // layout either.
    return splitIntoLines(entry.keyResponsibilities).slice(0, MAX_BULLETS_PER_ROLE);
  });
}

function fallbackSummary(profile: Profile): string {
  const title = profile.currentTitle || "Professional";
  const skills = profile.skills.slice(0, 3).join(", ") || "their field";
  return `${title} with experience in ${skills}.`;
}

export async function generateResumeContent(
  profile: Profile,
): Promise<{ success: true; data: GeneratedResumeContent } | { success: false; error: string }> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.55,
      max_tokens: 1400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(profile) },
      ],
    });

    const rawContent = response.choices[0]?.message.content;
    if (!rawContent) {
      return { success: false, error: "Resume generation returned no content. Please try again." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("[agent/resume-generator]", parseError);
      return { success: false, error: "Resume generation returned an unreadable response. Please try again." };
    }

    const validated = generatedResumeSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("[agent/resume-generator]", validated.error);
      return { success: false, error: "Resume generation returned an unexpected response. Please try again." };
    }

    const summary =
      validated.data.summary.trim().length > 0 ? validated.data.summary : fallbackSummary(profile);
    const workExperienceBullets = reconcileBullets(profile, validated.data.workExperienceBullets);

    return { success: true, data: { summary, workExperienceBullets } };
  } catch (error) {
    console.error("[agent/resume-generator]", error);
    return { success: false, error: "Something went wrong generating your resume. Please try again." };
  }
}
