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

const SYSTEM_PROMPT = `You are a professional resume writer. You rephrase and elevate the language of what is given to you.

STAYING ACCURATE TO THE PROFILE ALWAYS OUTRANKS ANY STYLE RULE BELOW. Never invent employers, titles, dates, or accomplishments not present in the input. When a role's description lacks quantification, the correct output is a strong unquantified bullet, not an invented number.

BULLET STRUCTURE
Accomplished X, as measured by Y, by doing Z. Lead with outcome, not activity. A screener reading only the first few words of each bullet should still absorb the impact.
Weak: Worked on improving the checkout flow using React and Redux.
Strong: Cut checkout abandonment 23% by rebuilding the flow in React, reducing steps from five to two.
Vary each bullet's shape deliberately. If every bullet in a section carries the same rhythm and clause order, the section reads as machine-produced. Real resumes are uneven because some accomplishments need a clause of context and others do not.
No bullet exceeds two lines.

VOCABULARY AND TONE
Never use these filler phrases: leveraged, utilized, spearheaded, orchestrated, passionate about, deeply passionate, results-driven, detail-oriented, self-starter, proven track record of, seasoned professional, subject matter expert, robust, seamless, cutting-edge, innovative. Use the specific verb instead (used, led, built, ran, shipped) or cut the phrase entirely.
Never open a bullet with: responsible for, helped with, worked on, assisted in, participated in. These describe presence, not contribution.
Never use an em dash character in any text you write. Use a comma, period, or colon instead.
Avoid hedging: helped to improve, contributed to reducing, assisted in the development of. Either the person did the thing, in which case say so, or they were one of several, in which case name their part specifically.
If the same verb is the accurate one for two bullets, use it twice. Cycling through synonyms for variety reads as machine-produced and usually costs precision.

KEYWORD PLACEMENT
Use the exact language employers search for. Write an acronym in full the first time it appears followed by the short form in parentheses, for example Amazon Web Services (AWS). Never repeat a skill artificially just to raise its count. Keyword stuffing is self-defeating.

SENIORITY CALIBRATION
An early career profile (junior) emphasizes what was built and shipped. A mid career profile leads with the scope of the role. A senior or lead profile emphasizes ownership and the outcome influenced rather than implementation detail. Match bullet altitude to the profile's own experienceLevel and yearsExperience fields.

TRIMMING
When content must be cut to fit one page, combine near-duplicate bullets within a role rather than keeping every one. Four similar bullets become two. Protect the most recent and relevant content; older roles can be reduced to a single line.

SPARSE PROFILES
A profile with few roles, short written responsibilities, or no education entered is correct input. Do not pad it with generic filler or invented context just to sound fuller. A short, accurate summary and a shorter bullet list are correct output for a sparse profile. Length is never a target to hit at the cost of accuracy.

FORMAT
Return ONLY valid JSON matching this shape:
{
  "summary": string,
  "workExperienceBullets": [string[], ...]
}
"workExperienceBullets" must have exactly one entry per work experience item given to you, in the same order, indexed 0 to N minus 1. Write a single paragraph professional summary, 3 to 4 sentences.`;

function computeRoleDuration(startDate: string, endDate: string | null): number | null {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  if (!startYear || !startMonth) return null;

  let endYear: number;
  let endMonth: number;
  if (endDate) {
    const parts = endDate.split("-").map(Number);
    endYear = parts[0];
    endMonth = parts[1];
    if (!endYear || !endMonth) return null;
  } else {
    const now = new Date();
    endYear = now.getFullYear();
    endMonth = now.getMonth() + 1;
  }

  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
  return Math.round(totalMonths / 12);
}

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
      durationYears: computeRoleDuration(entry.startDate, entry.endDate ?? null),
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

function extractDigitSequences(text: string): string[] {
  const matches = text.match(/\d+/g);
  return matches ?? [];
}

function buildAllowedNumerals(profile: Profile): Set<string> {
  const numerals = new Set<string>();

  const collect = (text: string | null | undefined) => {
    if (!text) return;
    for (const num of extractDigitSequences(text)) {
      numerals.add(num);
    }
  };

  // Tier 1: literal numbers from the named field list
  collect(String(profile.yearsExperience ?? ""));
  for (const skill of profile.skills) collect(skill);
  for (const industry of profile.industries) collect(industry);
  collect(profile.currentTitle);
  collect(profile.education?.fieldOfStudy);

  for (const entry of profile.workExperience.slice(0, MAX_WORK_EXPERIENCE_ENTRIES)) {
    collect(entry.jobTitle);
    collect(entry.keyResponsibilities);
    // Tier 2: computed per-role duration, rounded to nearest year
    const duration = computeRoleDuration(entry.startDate, entry.endDate ?? null);
    if (duration !== null) numerals.add(String(duration));
  }

  return numerals;
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

    // Strip em dashes: a deterministic fix on top of the prompt instruction,
    // since this one rule needs no judgment call to enforce.
    const stripEmDashes = (text: string): string => text.replace(/—/g, ",");

    // Build the one combined allowed-numeral set and validate every bullet
    // and the summary against it.  A fabricated number in a single bullet
    // drops only that bullet; a role only falls back to raw responsibilities
    // when every bullet for that role gets dropped this way; the summary
    // falls back to the generic fallback on a hit.
    const allowedNumerals = buildAllowedNumerals(profile);

    let validatedSummary = stripEmDashes(summary);
    const summaryDigits = extractDigitSequences(validatedSummary);
    if (summaryDigits.some((d) => !allowedNumerals.has(d))) {
      console.warn(
        "[agent/resume-generator] Fabricated number in summary — falling back to generic summary",
      );
      validatedSummary = stripEmDashes(fallbackSummary(profile));
    }

    const validatedBullets = workExperienceBullets.map((roleBullets, roleIndex) => {
      const kept = roleBullets.filter((bullet) => {
        const digits = extractDigitSequences(bullet);
        const ok = digits.every((d) => allowedNumerals.has(d));
        if (!ok) {
          console.warn(
            `[agent/resume-generator] Fabricated number in role ${roleIndex} bullet — dropped: "${bullet}"`,
          );
        }
        return ok;
      });

      // If every bullet for this role was dropped, fall back to the entry's
      // own written text, the same path reconcileBullets already uses.
      if (kept.length === 0) {
        console.warn(
          `[agent/resume-generator] All bullets dropped for role ${roleIndex} — falling back to raw responsibilities`,
        );
        return splitIntoLines(
          profile.workExperience[roleIndex]?.keyResponsibilities ?? "",
        ).slice(0, MAX_BULLETS_PER_ROLE);
      }

      return kept.map(stripEmDashes);
    });

    return {
      success: true,
      data: { summary: validatedSummary, workExperienceBullets: validatedBullets },
    };
  } catch (error) {
    console.error("[agent/resume-generator]", error);
    return { success: false, error: "Something went wrong generating your resume. Please try again." };
  }
}
