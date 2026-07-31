import { Stagehand } from "@browserbasehq/stagehand";
import OpenAI from "openai";
import { z } from "zod";

import type { CompanyResearchDossier, JobRow, Profile } from "@/types";

const homepageExtractionSchema = z.object({
  oneLiner: z.string().describe("What the company does in one sentence"),
  productSummary: z.string().describe("What they build/sell and who it's for"),
  signals: z.array(z.string()).describe("Funding, notable customers, scale, mission, recent news"),
  pageLinks: z
    .array(
      z.object({
        url: z.string(),
        kind: z.enum(["about", "careers", "blog", "engineering", "product", "team", "other"]),
      }),
    )
    .describe("Internal links worth visiting"),
});

const subPageExtractionSchema = z.object({
  keyPoints: z.array(z.string()),
  technologies: z.array(z.string()).describe("Specific languages, frameworks, tools, platforms"),
  valuesOrCulture: z.array(z.string()).describe("Stated values, working style, team norms"),
  notable: z.array(z.string()).describe("Customers, funding, scale, projects, awards"),
});

const dossierSchema = z.object({
  companyOverview: z.string(),
  techStack: z.array(z.string()),
  culture: z.array(z.string()),
  whyThisRole: z.string(),
  yourEdge: z.array(z.string()),
  gapsToAddress: z.array(z.string()),
  smartQuestions: z.array(z.string()),
  interviewPrep: z.array(z.string()),
  sources: z.array(z.string()),
}) satisfies z.ZodType<CompanyResearchDossier>;

type HomepageResearch = z.infer<typeof homepageExtractionSchema>;
type SubPageResearch = z.infer<typeof subPageExtractionSchema>;

type BrowsedCompanyResearch = {
  homepage: HomepageResearch;
  subPages: SubPageResearch[];
} | null;

type ResearchJobInput = Pick<
  JobRow,
  "title" | "company" | "about_role" | "matched_skills" | "missing_skills" | "external_apply_url" | "source_url"
>;

const MAX_SUB_PAGES = 3;
const PREFERRED_LINK_KIND_ORDER = ["about", "engineering", "blog", "product", "team", "other", "careers"];

const SYNTHESIS_SYSTEM_PROMPT = `You are a sharp career strategist preparing a candidate to apply for a specific role.
You are given (a) research collected from the company's own website, (b) the job posting,
and (c) the candidate's profile. Produce a concise, concrete briefing that gives this
specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent
  funding, customers, headcount, or facts. If research was thin, infer carefully from
  the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this
  company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly
  and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind
  of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON matching this shape:
{
  "companyOverview": string,
  "techStack": string[],
  "culture": string[],
  "whyThisRole": string,
  "yourEdge": string[],
  "gapsToAddress": string[],
  "smartQuestions": string[],
  "interviewPrep": string[],
  "sources": string[]
}`;

export async function deriveCompanyHomepageUrl(job: Pick<JobRow, "company" | "external_apply_url" | "source_url">): Promise<string> {
  const redirectUrl = job.external_apply_url ?? job.source_url;

  if (redirectUrl) {
    try {
      const response = await fetch(redirectUrl, { redirect: "follow" });
      const finalUrl = new URL(response.url);
      if (!finalUrl.hostname.includes("adzuna.com")) {
        return `https://${stripSubdomain(finalUrl.hostname)}`;
      }
    } catch (error) {
      console.error("[agent/research]", error);
    }
  }

  return `https://www.${slugifyCompanyName(job.company)}.com`;
}

function stripSubdomain(hostname: string): string {
  const parts = hostname.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : hostname;
}

function slugifyCompanyName(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickSubPageUrls(pageLinks: HomepageResearch["pageLinks"], homepageUrl: string): string[] {
  const seen = new Set<string>();
  const resolved: { url: string; kind: string }[] = [];

  for (const link of pageLinks) {
    try {
      const absoluteUrl = new URL(link.url, homepageUrl).toString();
      if (!seen.has(absoluteUrl)) {
        seen.add(absoluteUrl);
        resolved.push({ url: absoluteUrl, kind: link.kind });
      }
    } catch {
      continue;
    }
  }

  resolved.sort(
    (a, b) => PREFERRED_LINK_KIND_ORDER.indexOf(a.kind) - PREFERRED_LINK_KIND_ORDER.indexOf(b.kind),
  );

  return resolved.slice(0, MAX_SUB_PAGES).map((link) => link.url);
}

async function collectCompanyResearch(homepageUrl: string): Promise<BrowsedCompanyResearch> {
  let stagehand: Stagehand | null = null;

  try {
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: { modelName: "gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    });
    await stagehand.init();

    const page = stagehand.context.pages()[0];
    await page.goto(homepageUrl);

    const homepage = await stagehand.extract(
      "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, customers, scale, mission, recent launches). Then find the internal links most worth visiting to research them as an employer.",
      homepageExtractionSchema,
    );

    if (!homepage.oneLiner.trim() && !homepage.productSummary.trim()) {
      return null;
    }

    const subPageUrls = pickSubPageUrls(homepage.pageLinks, homepageUrl);
    const subPages: SubPageResearch[] = [];

    for (const subPageUrl of subPageUrls) {
      try {
        await page.goto(subPageUrl);
        const subPage = await stagehand.extract(
          "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.",
          subPageExtractionSchema,
        );
        subPages.push(subPage);
      } catch (error) {
        console.error("[agent/research]", error);
      }
    }

    return { homepage, subPages };
  } catch (error) {
    console.error("[agent/research]", error);
    return null;
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}

function buildSynthesisUserMessage(
  job: ResearchJobInput,
  profile: Profile,
  research: BrowsedCompanyResearch,
): string {
  return JSON.stringify({
    companyResearch: research
      ? { homepage: research.homepage, subPages: research.subPages }
      : "No research could be collected from the company website. Base the briefing on the job posting and candidate profile only, and say so in companyOverview.",
    jobPosting: {
      title: job.title,
      company: job.company,
      description: job.about_role,
      matchedSkills: job.matched_skills,
      missingSkills: job.missing_skills,
    },
    candidateProfile: {
      currentTitle: profile.currentTitle,
      experienceLevel: profile.experienceLevel,
      yearsExperience: profile.yearsExperience,
      skills: profile.skills,
      workExperience: profile.workExperience,
    },
  });
}

async function synthesizeDossier(
  job: ResearchJobInput,
  profile: Profile,
  research: BrowsedCompanyResearch,
): Promise<{ success: true; data: CompanyResearchDossier } | { success: false; error: string }> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        { role: "user", content: buildSynthesisUserMessage(job, profile, research) },
      ],
    });

    const rawContent = response.choices[0]?.message.content;
    if (!rawContent) {
      return { success: false, error: "Research returned no content." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("[agent/research]", parseError);
      return { success: false, error: "Research returned an unreadable response." };
    }

    const validated = dossierSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("[agent/research]", validated.error);
      return { success: false, error: "Research returned an unexpected response." };
    }

    return { success: true, data: validated.data };
  } catch (error) {
    console.error("[agent/research]", error);
    return { success: false, error: "Something went wrong researching this company." };
  }
}

export async function runCompanyResearch(
  job: ResearchJobInput,
  profile: Profile,
): Promise<{ success: true; data: CompanyResearchDossier } | { success: false; error: string }> {
  const homepageUrl = await deriveCompanyHomepageUrl(job);
  const research = await collectCompanyResearch(homepageUrl);
  return synthesizeDossier(job, profile, research);
}
