export type MockJob = {
  id: string;
  company: string;
  title: string;
  matchScore: number;
  salary: string;
  source: "search" | "url";
  foundAtLabel: string;
  location: string;
  externalApplyUrl: string;
};

export const mockJobs: MockJob[] = [
  {
    id: "mock-vercel-senior-frontend-engineer",
    company: "Vercel",
    title: "Senior Frontend Engineer",
    matchScore: 94,
    salary: "$160k - $200k",
    source: "search",
    foundAtLabel: "2 hours ago",
    location: "Remote",
    externalApplyUrl: "https://vercel.com/careers",
  },
  {
    id: "mock-stripe-staff-ui-engineer",
    company: "Stripe",
    title: "Staff UI Engineer",
    matchScore: 88,
    salary: "$180k - $240k",
    source: "url",
    foundAtLabel: "Yesterday",
    location: "San Francisco, CA",
    externalApplyUrl: "https://stripe.com/jobs",
  },
  {
    id: "mock-linear-product-engineer",
    company: "Linear",
    title: "Product Engineer",
    matchScore: 96,
    salary: "$150k - $190k",
    source: "search",
    foundAtLabel: "Yesterday",
    location: "Remote",
    externalApplyUrl: "https://linear.app/careers",
  },
  {
    id: "mock-notion-frontend-developer",
    company: "Notion",
    title: "Frontend Developer",
    matchScore: 72,
    salary: "$130k - $170k",
    source: "url",
    foundAtLabel: "2 days ago",
    location: "New York, NY",
    externalApplyUrl: "https://notion.so/careers",
  },
  {
    id: "mock-openai-design-engineer",
    company: "OpenAI",
    title: "Design Engineer",
    matchScore: 91,
    salary: "$200k - $280k",
    source: "search",
    foundAtLabel: "3 days ago",
    location: "San Francisco, CA",
    externalApplyUrl: "https://openai.com/careers",
  },
  {
    id: "mock-figma-software-engineer-editor",
    company: "Figma",
    title: "Software Engineer, Editor",
    matchScore: 85,
    salary: "$170k - $220k",
    source: "url",
    foundAtLabel: "4 days ago",
    location: "Remote",
    externalApplyUrl: "https://figma.com/careers",
  },
];

export type MatchScoreTier = "high" | "medium" | "low";

export function getMatchScoreTier(matchScore: number): MatchScoreTier {
  if (matchScore >= 90) {
    return "high";
  }

  if (matchScore >= 80) {
    return "medium";
  }

  return "low";
}
