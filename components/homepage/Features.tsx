import Image from "next/image";
import { BrainCircuit, Building2, LayoutDashboard } from "lucide-react";

type FeatureItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center text-accent">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
        <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <div className="bg-background">
      {/* Feature 1 — Manage your search */}
      <section className="max-w-300 mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div className="flex flex-col gap-10">
            <div>
              <p className="text-xs font-medium text-accent uppercase tracking-widest mb-3">
                Job Discovery
              </p>
              <h2 className="text-[32px] font-bold leading-tight text-text-primary">
                Manage Your Job Search With Ease
              </h2>
            </div>

            <div className="flex flex-col gap-8">
              <FeatureItem
                icon={<BrainCircuit size={20} />}
                title="Finds Jobs That Actually Fit"
                description="Enter a title and location — JobPilot queries Adzuna and scores every result 0–100 against your real skills using GPT-4o. No more manually sifting through irrelevant listings."
              />
              <FeatureItem
                icon={<Building2 size={20} />}
                title="Know the Company Before You Apply"
                description="One click triggers our research agent. It browses the company's own website, extracts what matters, and delivers a structured dossier — tech stack, culture, why the role exists."
              />
              <FeatureItem
                icon={<LayoutDashboard size={20} />}
                title="Keep Track of Every Application"
                description="Your dashboard shows total jobs found, average match rate, companies researched, and weekly activity — all updated automatically as you search."
              />
            </div>
          </div>

          {/* Image */}
          <div className="rounded-2xl overflow-hidden border border-border shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
            <Image
              src="/images/jobs-lists.png"
              alt="Jobs list with match scores"
              width={680}
              height={500}
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>

      {/* Feature 2 — Company Research */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-300 mx-auto px-6 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden border border-border shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
              <Image
                src="/images/agnet-log.png"
                alt="AI company research agent output"
                width={680}
                height={500}
                className="w-full h-auto block"
              />
            </div>

            {/* Text */}
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs font-medium text-accent uppercase tracking-widest mb-3">
                  Company Research
                </p>
                <h2 className="text-[32px] font-bold leading-tight text-text-primary mb-4">
                  Know the Company Inside Out Before the Interview
                </h2>
                <p className="text-base text-text-secondary leading-relaxed">
                  Our research agent opens a real browser session, visits the company&apos;s homepage,
                  blog, and engineering pages — then synthesizes everything into a structured
                  briefing tailored to your specific background and the role you&apos;re applying for.
                </p>
              </div>

              <ul className="flex flex-col gap-3">
                {[
                  "Company overview, tech stack, and working culture",
                  "Why this specific role exists at this company",
                  "Your personal edge for this role based on your profile",
                  "Smart interview questions that show you did your homework",
                  "Gaps to address — reframed as strengths, not weaknesses",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-text-secondary">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3 — Apply with confidence */}
      <section className="max-w-300 mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-medium text-accent uppercase tracking-widest mb-3">
                Match Scoring
              </p>
              <h2 className="text-[32px] font-bold leading-tight text-text-primary mb-4">
                Apply With More Confidence, Every Time
              </h2>
              <p className="text-base text-text-secondary leading-relaxed">
                Every job gets an AI match score, a plain-English explanation of why it fits,
                a list of skills you already have that match, and an honest look at any gaps — so
                you can make smart decisions about where to invest your time.
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {[
                "Understand exactly how well a role fits before applying",
                "AI Precision Job Matching — scored 0–100 against your actual skills",
                "Matched skills highlighted in green, missing skills flagged clearly",
                "Focus on the right roles and skip the noise",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Image */}
          <div className="rounded-2xl overflow-hidden border border-border shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
            <Image
              src="/images/jobs-lists.png"
              alt="Job match score breakdown"
              width={680}
              height={500}
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
