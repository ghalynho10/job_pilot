# Library Docs

Project-specific usage patterns for every third party library in this project. This file only covers how we use each library in this specific project — rules, patterns, and constraints specific to JobPilot.

Read the relevant section before implementing any feature that touches these libraries.

---

## Before Using Any Library

Before implementing any feature that uses a third party library:

1. **Check AGENTS.md** at the project root — it lists every skill installed for this project and how to use them. Skills contain up-to-date API documentation, usage patterns, and best practices specific to this codebase.

2. **Check if an MCP server is configured** for that library. Some tools have MCP servers that give the AI agent direct access to documentation, logs, and debugging tools. If an MCP server is available — use it before falling back to general knowledge.

3. **Read this file** for project-specific patterns that override general library knowledge.

The order of authority is:

```
MCP server (real-time docs) → Skills via AGENTS.md → This file (project rules) → General training knowledge
```

Never rely on general training knowledge alone for library APIs — they change frequently and training data may be outdated.

---

## InsForge

**Check first:** Check AGENTS.md for an installed InsForge skill. If an InsForge MCP server is configured — use it. The skill/MCP will have the latest API patterns.

### Client vs Server

Two separate instances — never mix them:

```typescript
// lib/insforge-client.ts — browser context only
import { createBrowserClient } from "@insforge/sdk/ssr";

export const insforge = createBrowserClient();
```

```typescript
// lib/insforge-server.ts — server context only
import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

export const createInsforgeServer = async () => {
  return createServerClient({ cookies: await cookies() });
};
```

**Rules:**

- Browser client — Client Components, browser-side auth state, realtime subscriptions
- Server client — Server Components, API routes, Server Actions, agent functions
- Auth mutations — `createAuthActions()` in Server Actions and callback routes
- Session refresh — `updateSession()` in Next.js 16 `proxy.ts`
- Never use browser client in server context
- Never use server client in browser context

---

### Auth

```typescript
// Get current user in server context
const insforge = await createInsforgeServer();
const {
  data: { user },
  error,
} = await insforge.auth.getCurrentUser();
if (!user) redirect("/login");
```

OAuth in Next.js uses a server owned PKCE flow:

1. Call `createAuthActions().signInWithOAuth()` with
   `skipBrowserRedirect: true`.
2. Build `redirectTo` from the canonical `NEXT_PUBLIC_APP_URL`.
3. Save `data.codeVerifier` in an httpOnly cookie for up to 10 minutes.
4. Redirect to `data.url`.
5. In `/callback`, call `exchangeOAuthCode(insforgeCode, codeVerifier)`.
6. Redirect successful sessions to `/dashboard`.

---

### DB Queries

```typescript
// Read
const { data, error } = await insforge.database
  .from("jobs")
  .select("*")
  .eq("user_id", user.id)
  .order("found_at", { ascending: false });

// Insert
const { data, error } = await insforge.database
  .from("jobs")
  .insert({ user_id: user.id, title, company, match_score })
  .select()
  .single();

// Update
const { error } = await insforge.database
  .from("jobs")
  .update({ company_research: dossier })
  .eq("id", jobId)
  .eq("user_id", user.id); // always scope to user
```

**Rules:**

- The accessor is `insforge.database.from(table)` — there is no top level `insforge.from(table)`, that call does not exist on the SDK client (confirmed directly against the installed SDK's type exports; `.database.from()` returns a `@supabase/postgrest-js` `PostgrestQueryBuilder`, which is also where `.upsert()` and `.maybeSingle()` come from)
- Always scope queries to `user_id` — never query without user filter
- Always handle the `error` return — never assume success
- Use `.single()` when expecting exactly one row, `.maybeSingle()` when a matching row might not exist yet

---

### Storage

```typescript
// Upload file — .upload() takes no options object (no contentType, no
// upsert); storage never overwrites an existing key, a second upload to
// the same key silently succeeds under a renamed key instead (confirmed
// directly against the live backend, not assumed from general knowledge).
// Target a fresh, unique key every time so there is nothing to collide with:
//
// .upload(path, file) is typed as File | Blob only — a server side Node
// Buffer (e.g. from renderToBuffer or a fetch response) is NOT accepted
// directly and fails typecheck; wrap it first:
// const fileBuffer = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
const key = `${userId}/${randomUUID()}.pdf`;
const { data, error } = await insforge.storage.from("resumes").upload(key, fileBuffer);

// Only the returned key is durable — persist data.key to the DB, never a URL

// Reading a stored file back: the resumes bucket is PRIVATE, so
// getPublicUrl() never resolves for it. Mint a short lived signed URL
// instead, only at the point it is actually needed:
const { data: signed } = await insforge.storage.from("resumes").createSignedUrl(key);
const url = signed.signedUrl; // expires; never cache this, never store it

// Replacing a file: upload the new key, write it to the DB, only then
// remove the old key (never delete before the new write succeeds)
await insforge.storage.from("resumes").remove(previousKey);
```

**Storage paths:**

- Resume uploads: `resumes/{user_id}/{a random id}.pdf`, a fresh key every upload, never a fixed path

**Rules:**

- `.upload(path, file)` takes exactly two arguments — no `contentType`, no `upsert`, no options object at all
- Storage never overwrites a key — never target a fixed path expecting an overwrite; use a fresh unique key per upload
- Replacing a file is upload new key, write it, then delete the old key, never delete-then-upload (a failed upload or write must never cost the existing file)
- `resumes` is a private bucket — `getPublicUrl()` only resolves for a public bucket and must not be used here; use `createSignedUrl()` instead, and only call it at the point a link is actually needed
- Persist only the object key to the DB, never a URL (a signed URL expires, and a private bucket's plain URL never resolves without auth)
- Never write files to disk — always upload buffer/File directly to storage

---

## InsForge Payments: Stripe

**Check first:** Use the `insforge-cli` skill for provider setup and catalog sync, and the `insforge` skill for app code that creates Checkout or Billing Portal sessions. Stripe best practices also apply to plan shape, Checkout, webhooks, key handling, and tax.

### Current Test Catalog

- Environment: `test`
- Product: `Pro` (`prod_UzqR2eky7x4Jco`)
- Price: `price_1Tzql4HWEI4hd2koBoXmbWLF`
- Amount: `$9/month` (`currency: usd`, `unitAmount: 900`, `recurringInterval: month`)

### Setup And Inspection

```bash
npx @insforge/cli payments stripe status
npx @insforge/cli payments stripe catalog --environment test --json
```

Stripe keys belong in InsForge's managed payments config via `npx @insforge/cli payments stripe config set`. Never store Stripe secret keys as generic app secrets, in source code, or in committed env files.

### App Integration Pattern

Use InsForge Payments from app code, not a direct Stripe SDK dependency, unless a future spec explicitly changes this decision:

```typescript
const { data, error } = await insforge.payments.stripe.createCheckoutSession(
  "test",
  {
    mode: "subscription",
    lineItems: [{ priceId: "price_1Tzql4HWEI4hd2koBoXmbWLF", quantity: 1 }],
    successUrl: `${origin}/billing/success`,
    cancelUrl: `${origin}/billing`,
    subject: { type: "user", id: user.id },
    customerEmail: user.email,
    idempotencyKey: `user:${user.id}:pro-monthly`,
  },
);
```

Before wiring UI, add app specific RLS on `payments.stripe_checkout_sessions` for authenticated users where `subject_type = 'user'` and `subject_id = auth.uid()::text`. Add both `INSERT` and `SELECT` policies if checkout uses an `idempotencyKey`.

### Fulfillment

Durable subscription fulfillment must come from verified `payments.webhook_events`, not from Checkout success URLs and not from `payments.transactions`. App owned fulfillment writes to `public.subscriptions`.

Subscription events can arrive out of order. Resolve the billing subject from event payload metadata first, then use `payments.customer_mappings` only as a fallback. Trigger functions must be idempotent and must never downgrade newer subscription state with an older retried event.

### Stripe Rules

- Use Billing APIs with hosted Checkout for subscriptions.
- Omit `payment_method_types`; let Stripe dynamic payment methods apply.
- Use the Customer Portal for future self service billing management.
- Do not enable `automatic_tax` unless active tax registrations are confirmed. The current Pro price has `taxBehavior: unspecified`, and tax setup remains a future decision.

---

## Adzuna API

**Check first:** Check AGENTS.md for an installed Adzuna skill. If none exists — use this file and the official Adzuna API docs.

### Job Search

```typescript
// lib/adzuna.ts
export async function searchJobs(
  jobTitle: string,
  location: string,
  country: string = "us",
): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    what: jobTitle,
    category: "it-jobs", // always filter to IT jobs
    results_per_page: "10",
    "content-type": "application/json",
  });

  // Only add where if location is provided
  if (location) {
    params.set("where", location);
  }

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
  );

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}
```

### Response Shape

Each Adzuna job result contains:

```typescript
type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string; // snippet only — not full description
  redirect_url: string; // Adzuna tracking URL → redirects to actual job
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1"; // "1" means salary is estimated
  contract_type?: string;
  created: string; // ISO date string
  category: { tag: string; label: string };
};
```

### Saving Jobs to DB

```typescript
// Map Adzuna result to jobs table
const jobRecord = {
  user_id: userId,
  run_id: runId,
  source: "search", // always 'search' for Adzuna jobs
  source_url: job.redirect_url,
  external_apply_url: job.redirect_url,
  title: job.title,
  company: job.company.display_name,
  location: job.location.display_name,
  salary: job.salary_min
    ? `$${Math.round(job.salary_min / 1000)}k - $${Math.round(job.salary_max! / 1000)}k`
    : null,
  job_type: job.contract_type || "fulltime",
  about_role: job.description, // Adzuna returns snippet — used as description
  match_score: scoredJob.matchScore,
  match_reason: scoredJob.matchReason,
  matched_skills: scoredJob.matchedSkills,
  missing_skills: scoredJob.missingSkills,
  found_at: new Date().toISOString(),
};
```

**Rules:**

- Always include `category=it-jobs` — never search Adzuna without this filter
- Never pass `where` if location is empty — omit the parameter entirely
- `source` is always `'search'` for Adzuna jobs — never any other value
- `salary_is_predicted: "1"` means Adzuna estimated the salary — this is normal
- Adzuna description is a snippet — GPT-4o scores from it, not a full description
- Default country to `'us'` — support `gb`, `au`, `ca` as alternatives

---

## Browserbase

**Check first:** Check AGENTS.md for an installed Browserbase skill. If a Browserbase MCP server is configured — use it. The skill/MCP will have the latest session management and API patterns.

### Session Creation — Company Research

```typescript
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

// Single session for company research — sequential page visits
const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  timeout: 120, // 2 minute session — visits 3-4 pages max
});
```

**Important — the research route blocks for the full session:**
The Browserbase session itself runs on Browserbase's cloud infrastructure, but the API route (`app/api/agent/research/route.ts`) awaits the entire session plus synthesis before responding. It does not return early while the session continues. Because the request stays open for the full run, the route exports `maxDuration` (300, the highest allowed on the Vercel Hobby plan) and `dynamic = "force-dynamic"` to maximize its allowed execution window. Do not remove that configuration; the route needs every second the plan allows.

**Rules:**

- Always use single sessions — never parallel sessions (free plan limit)
- Session timeout is 120 seconds — sufficient for 3-4 page visits
- Always end sessions cleanly — call stagehand.close() when done
- Project ID always from `process.env.BROWSERBASE_PROJECT_ID` — never hardcode
- Browserbase client lives in `lib/browserbase.ts` — always import from there

---

## Stagehand

**Check first:** Check AGENTS.md for an installed Stagehand skill. If a Stagehand MCP server is configured — use it. The skill/MCP will have the latest act() and extract() patterns.

### Initialisation

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY!,
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserbaseSessionID: session.id,
  model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY! },
  disablePino: true,
});

await stagehand.init();
const page = stagehand.context.activePage()!;
```

### extract()

```typescript
import { z } from "zod";

const result = await stagehand.extract({
  instruction:
    "Extract the company overview, main product description, and any technology mentions from this page.",
  schema: z.object({
    companyOverview: z.string().optional(),
    mainProduct: z.string().optional(),
    techMentions: z.array(z.string()).optional(),
    navLinks: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
  }),
});
```

### act()

```typescript
// Always wrap in try/catch
try {
  await stagehand.act({
    action: "Click the About link in the navigation",
  });
} catch (error) {
  await logAgentError(jobId, null, error);
}
```

## Company Research Section

Replace the existing Stagehand "Company Research Pattern" section in library-docs.md with this:

---

### Company Research Pattern

Three-step process: homepage extraction → sub-page extraction → GPT-4o synthesis.
Job description and user profile come from DB — never re-fetch what you already have.
Browser's only job is the company website.

```typescript
// Step 1 — Homepage extraction
const homepageData = await stagehand.extract({
  instruction:
    "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, customers, scale, mission, recent launches). Then find the internal links most worth visiting to research them as an employer.",
  schema: z.object({
    oneLiner: z.string().describe("What the company does in one sentence"),
    productSummary: z
      .string()
      .describe("What they build/sell and who it's for"),
    signals: z
      .array(z.string())
      .describe("Funding, notable customers, scale, mission, recent news"),
    pageLinks: z
      .array(
        z.object({
          url: z.string(),
          kind: z.enum([
            "about",
            "careers",
            "blog",
            "engineering",
            "product",
            "team",
            "other",
          ]),
        }),
      )
      .describe("Internal links worth visiting"),
  }),
});

// If oneLiner and productSummary are empty — wrong site or parked domain
// Skip to synthesis with job description and profile only
if (!homepageData.oneLiner && !homepageData.productSummary) {
  await stagehand.close();
  // proceed to synthesis with empty companyResearch
}

// Step 2 — Sub-page extraction (max 3, prefer about/blog/engineering/product over careers)
const subPageData = await stagehand.extract({
  instruction:
    "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.",
  schema: z.object({
    keyPoints: z.array(z.string()),
    technologies: z
      .array(z.string())
      .describe("Specific languages, frameworks, tools, platforms"),
    valuesOrCulture: z
      .array(z.string())
      .describe("Stated values, working style, team norms"),
    notable: z
      .array(z.string())
      .describe("Customers, funding, scale, projects, awards"),
  }),
});

// Step 3 — GPT-4o synthesis (after browser closes)
// Feed three data sources: company research + job from DB + profile from DB
const systemPrompt = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research collected from the company's own website, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent funding, customers, headcount, or facts. If research was thin, infer carefully from the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind of detail that signals the candidate did their homework.
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

const userPrompt = `COMPANY RESEARCH (from their website):
${JSON.stringify(companyResearch)}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Matched skills (already computed): ${job.matched_skills.join(", ")}
Missing skills (already computed): ${job.missing_skills.join(", ")}

CANDIDATE PROFILE:
Current title: ${profile.current_title}
Experience: ${profile.years_experience} years, level ${profile.experience_level}
Skills: ${profile.skills.join(", ")}
Work history: ${JSON.stringify(profile.work_experience)}`;

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  response_format: { type: "json_object" },
  temperature: 0.4,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
});
```

**Dossier fields:**

| Field           | Type     | Purpose                                             |
| --------------- | -------- | --------------------------------------------------- |
| companyOverview | string   | What the company does                               |
| techStack       | string[] | Technologies they use                               |
| culture         | string[] | Values and working style                            |
| whyThisRole     | string   | Why this role exists                                |
| yourEdge        | string[] | Specific links between THIS candidate and this role |
| gapsToAddress   | string[] | Missing skills reframed as strategy                 |
| smartQuestions  | string[] | Questions that show real research                   |
| interviewPrep   | string[] | Topics to prepare for this role                     |
| sources         | string[] | Pages the company info came from                    |

**Rules:**

- Always use `extract()` with a Zod schema — never parse raw HTML or use regex
- Always wrap every `act()` and `extract()` in try/catch
- Always call `await stagehand.close()` when done — ends the Browserbase session
- Model is always `gpt-4o` — never use other models
- Temperature is `0.4` for synthesis — grounded but flexible enough to make real connections
- Max 3 sub-pages — never exceed this on free plan
- Always close session in finally block — never leave sessions open even if research fails
- Job description and profile always come from DB — never re-fetch via browser
- If browser research returns empty — still run synthesis with job + profile only
- yourEdge, gapsToAddress, and smartQuestions are the most valuable fields — never skip them

## OpenAI GPT-4o

**Check first:** Check AGENTS.md for an installed OpenAI skill. The skill will have the latest API patterns and model capabilities.

### Structured JSON Response

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  response_format: { type: "json_object" },
  temperature: 0.3,
  messages: [
    {
      role: "system",
      content: "You are a job matching assistant. Return only valid JSON.",
    },
    {
      role: "user",
      content: `Your prompt here`,
    },
  ],
});

const result = JSON.parse(response.choices[0].message.content!);
```

**Temperature settings:**

- `0.3` — matching, scoring, extraction, research synthesis — deterministic results
- `0.55` — resume generation (`agent/resume-generator.ts`) — generative enough to write natural prose, still constrained by the system prompt's "never invent" rule

**Max tokens:**

- Job matching + scoring: `300`
- Company research synthesis: `800`
- Resume generation: `1400` (covers a summary paragraph plus up to 3 roles' bullets, `agent/resume-generator.ts`; work experience is capped at 3 entries before the prompt is built, so this budget can't be exceeded by a large profile)
- Profile extraction from resume: `800`

**Rules:**

- Model string is always `'gpt-4o'` — never use other model names
- Always use `response_format: { type: 'json_object' }` for structured data
- Always parse `response.choices[0].message.content` as string — even with json_object it returns a string
- Always validate parsed JSON before using — wrap in try/catch
- Match threshold is always `MATCH_THRESHOLD` from `lib/utils.ts` — never hardcode 70
- Company research synthesis must always return a complete dossier — never return empty even if browser research failed

---

## PostHog

**Check first:** Check AGENTS.md for an installed PostHog skill. If a PostHog MCP server is configured — use it. The skill/MCP will have the latest client and server patterns.

### Client Setup (Browser)

```typescript
// lib/posthog-client.ts
import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window !== "undefined") {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
      capture_pageview: false, // manual pageview tracking
    });
  }
}

// Capture event client-side
posthog.capture("job_found", {
  userId,
  source: "search",
  matchScore: score,
});
```

### Server Setup

```typescript
// lib/posthog-server.ts
import { PostHog } from "posthog-node";

export const createPostHogServer = () =>
  new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    flushAt: 1, // send immediately
    flushInterval: 0, // no batching — Next.js functions are short-lived
  });

// Always use and shutdown in the same function
const posthog = createPostHogServer();
posthog.capture({
  distinctId: userId,
  event: "company_researched",
  properties: { userId, jobId, company },
});
await posthog.shutdown(); // required — ensures event is sent
```

**Rules:**

- Always call `await posthog.shutdown()` in server-side functions — events are lost without it
- `flushAt: 1` and `flushInterval: 0` always set on server client
- Event names must match exactly the list in `code-standards.md`
- Always include `userId` as a property on every server-side event
- Call `posthog.identify(userId)` after login on client side
- Call `posthog.reset()` on logout on client side

---

## @react-pdf/renderer

**Check first:** Check AGENTS.md for an installed react-pdf skill. PDF generation APIs can differ from general training knowledge.

### Resume PDF Generation

```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica' },
  section: { marginBottom: 10 },
  heading: { fontSize: 14, fontWeight: 'bold' },
  text: { fontSize: 10 },
})

const ResumePDF = ({ profile }: { profile: Profile }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.heading}>{profile.fullName}</Text>
        <Text style={styles.text}>{profile.email}</Text>
      </View>
    </Page>
  </Document>
)

// Generate buffer — Next.js Route Handlers must be named route.ts, and a
// .ts file cannot contain JSX syntax (only .tsx can). Either co-locate the
// Document component in its own .tsx file beside the route and call it via
// React.createElement from route.ts, or write the whole render pipeline in
// a .tsx file the route imports a plain function from:
import { createElement } from 'react'
const buffer = await renderToBuffer(createElement(ResumePDF, { profile }))

// Upload directly to InsForge Storage — a fresh unique key, see the
// Storage section above: .upload() takes no options object, storage never
// overwrites an existing key, and the buffer must be wrapped in a Blob
// (upload() only accepts File | Blob, not a raw Buffer)
const key = `${userId}/${randomUUID()}.pdf`
const pdfBlob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' })
await insforge.storage.from('resumes').upload(key, pdfBlob)
```

**Supported CSS properties:**
Only use these — others are silently ignored:
`padding, margin, fontSize, color, fontFamily, flexDirection, alignItems, justifyContent, borderRadius, width, height, fontWeight, textAlign, lineHeight`

**Rules:**

- Server-side only — never import in client components
- Always use `renderToBuffer` — not `renderToStream` or `PDFDownloadLink`
- PDF generation only in `app/api/resume/` routes
- Generated buffer uploaded directly to InsForge Storage, to a fresh unique key — never written to disk, never a fixed path
- `StyleSheet.create` values are a documented exception to the project wide "no hardcoded hex" rule: `@react-pdf/renderer`'s stylesheet cannot consume the project's CSS custom property tokens (it is not a browser stylesheet), so a hex value here (e.g. a muted text color) is the correct, unavoidable choice, not a violation to flag or fix
- Save the returned object key to the DB after upload, never a URL (see the Storage section above)

---

## pdf-parse

**Check first:** Check AGENTS.md for an installed pdf-parse skill.

### Extract Text from Uploaded Resume

The installed version is pdf-parse v2, whose API is entirely different from the
v1 `require('pdf-parse')(buffer)` shape — v2 wraps `pdfjs-dist` and needs its
worker module imported explicitly (confirmed against the installed package's
own troubleshooting docs, and against a real bug hit building feature 07: without
the worker import and `serverExternalPackages`, every call fails under Next.js's
server bundler with "Setting up fake worker failed").

```typescript
// Must import the worker entry before PDFParse itself, or pdfjs-dist fails
// with "Setting up fake worker failed" under Next.js's server bundler.
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// In API route handling resume extraction
export async function POST(req: NextRequest) {
  const arrayBuffer = await pdfResponse.arrayBuffer(); // e.g. from a fetched signed URL
  const buffer = Buffer.from(arrayBuffer);

  const parser = new PDFParse({ data: buffer });
  let extractedText: string;
  try {
    const result = await parser.getText();
    extractedText = result.text; // raw text content
  } finally {
    await parser.destroy(); // always free the parser, even on failure
  }

  // Send extractedText to GPT-4o for structured extraction
}
```

`next.config.ts` must also declare `serverExternalPackages: ["pdf-parse"]` so it
runs as a real server dependency instead of being bundled (see
`app/api/resume/extract/route.ts` and `next.config.ts`).

**Rules:**

- Server-side only — never import in client components
- Always `import "pdf-parse/worker"` before `import { PDFParse } from "pdf-parse"`, and list `pdf-parse` in `next.config.ts`'s `serverExternalPackages`
- Always call `await parser.destroy()` in a `finally` block, even when `getText()` throws
- `result.text` is raw unformatted text — GPT-4o handles the structure extraction
- Always handle parse errors — some PDFs are image-based and return empty text
- If `result.text` is empty or very short — return error to user: "Could not extract text from this PDF. Please try a different file."
