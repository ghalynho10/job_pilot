import OpenAI from "openai";
import { z } from "zod";

import type { JobMatch, Profile } from "@/types";

const jobMatchSchema = z.object({
  matchScore: z.number().catch(0),
  matchReason: z.string().catch(""),
  matchedSkills: z.array(z.string()).catch([]),
  missingSkills: z.array(z.string()).catch([]),
}) satisfies z.ZodType<JobMatch>;

const SYSTEM_PROMPT = `You are a precise job matching assistant. You score how well a candidate's profile matches one job posting.

Rules:
- matchScore is an integer from 0 to 100, how well the candidate's skills and experience fit this specific job. Score against these bands, and use the whole range rather than settling near the middle:
  - 90-100: meets essentially every stated requirement, and the seniority matches.
  - 70-89: meets the core requirements; the gaps are secondary or learnable on the job.
  - 50-69: meets some core requirements, with at least one significant gap.
  - 30-49: partial overlap only, or the wrong seniority for the role.
  - 0-29: a different discipline, or clearly unqualified.
- Pick the number the evidence supports, not a round one. Multiples of five are not preferred, and a score of exactly 70 or 75 is almost never the most accurate answer available.
- matchReason is one short paragraph explaining the score, grounded only in the candidate's profile and the job description given to you.
- matchedSkills lists only skills the candidate's profile already has that the job description also asks for.
- missingSkills lists only skills the job description asks for that are not in the candidate's profile.
- Never invent a skill, requirement, or fact not present in the profile or the job description.

Return ONLY valid JSON matching this shape:
{
  "matchScore": number,
  "matchReason": string,
  "matchedSkills": string[],
  "missingSkills": string[]
}`;

function buildUserMessage(
  job: { title: string; company: string; description: string },
  profile: Profile,
): string {
  return JSON.stringify({
    job: {
      title: job.title,
      company: job.company,
      description: job.description,
    },
    candidate: {
      currentTitle: profile.currentTitle,
      experienceLevel: profile.experienceLevel,
      yearsExperience: profile.yearsExperience,
      skills: profile.skills,
      industries: profile.industries,
      jobTitlesSeeking: profile.jobTitlesSeeking,
    },
  });
}

export async function scoreJobMatch(
  job: { title: string; company: string; description: string },
  profile: Profile,
): Promise<{ success: true; data: JobMatch } | { success: false; error: string }> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      // Scoring must be reproducible: the same profile against the same posting
      // has to return the same number twice. At 0.3 two near-identical listings
      // were landing on different scores purely from sampling jitter.
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(job, profile) },
      ],
    });

    const rawContent = response.choices[0]?.message.content;
    if (!rawContent) {
      return { success: false, error: "Matching returned no content." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("[agent/matcher]", parseError);
      return { success: false, error: "Matching returned an unreadable response." };
    }

    const validated = jobMatchSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("[agent/matcher]", validated.error);
      return { success: false, error: "Matching returned an unexpected response." };
    }

    return { success: true, data: validated.data };
  } catch (error) {
    console.error("[agent/matcher]", error);
    return { success: false, error: "Something went wrong scoring this job." };
  }
}
