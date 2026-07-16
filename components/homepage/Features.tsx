import Image from "next/image";
import Link from "next/link";

const applicationPoints = [
  ["Understand your match score", "See how your profile lines up with each role before you apply. Get a clear breakdown of what fits and what’s missing."],
  ["AI-Powered Job Matching", "Stop guessing which jobs are worth applying to. JobPilot scores every role against your actual skills so you focus on the ones that matter."],
  ["Focus on the right roles", "Filter out low fit jobs and stay on the ones that actually matter. Spend less time sorting and more time applying."],
];

function ArrowIcon() {
  return <span aria-hidden="true">▶</span>;
}

export function Features() {
  return (
    <>
      <section className="mx-auto max-w-[1440px] border-x border-t border-border bg-surface" aria-labelledby="confidence-title">
        <div className="grid lg:grid-cols-2">
          <div className="order-2 bg-surface-muted px-6 py-12 sm:px-10 lg:order-1 lg:px-12 lg:py-20">
            <Image
              alt="JobPilot agent activity log showing job search and resume preparation tasks"
              className="h-auto w-full rounded-xl border border-border shadow-sm"
              height={1656}
              sizes="(max-width: 1024px) 88vw, 620px"
              src="/images/agnet-log.png"
              width={2144}
            />
          </div>
          <div className="order-1 lg:order-2">
            <div className="border-b border-border px-8 py-20 lg:px-16 lg:py-24">
              <h2 className="max-w-md text-5xl font-semibold tracking-[-0.05em] text-text-primary sm:text-6xl" id="confidence-title">
                Apply With More Confidence, Every Time
              </h2>
            </div>
            {applicationPoints.map(([title, description], index) => (
              <article className={`border-b border-border px-8 py-8 lg:px-16 ${index === 1 ? "border-s-2 border-s-success" : ""}`} key={title}>
                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-text-primary">{title}</h3>
                <p className="mt-4 max-w-xl text-lg leading-8 text-text-secondary">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] border-x border-t border-border bg-surface px-6 py-24 text-center sm:px-12 lg:py-32" aria-labelledby="success-story-title">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-accent">Success Stories</p>
        <h2 className="mx-auto mt-8 max-w-5xl text-3xl font-medium leading-tight tracking-[-0.035em] text-text-slate sm:text-4xl lg:text-5xl" id="success-story-title">
          “I used to spend my evenings copy-pasting resumes. Now I open my dashboard to see interviews waiting. It feels like cheating. Had 3 offers on the table simultaneously.”
        </h2>
        <div className="mt-8 inline-flex items-center gap-3 text-start">
          <Image alt="Tom Wilson" className="rounded-md border border-border" height={56} src="/images/user-icon.png" width={56} />
          <div>
            <p className="text-lg font-semibold text-text-primary">Tom Wilson</p>
            <p className="mt-1 text-base text-text-secondary">Junior Developer</p>
          </div>
        </div>
      </section>

      <section className="hero-gradient mx-auto max-w-[1440px] border border-border px-6 py-24 text-center sm:px-12 lg:py-32" aria-labelledby="closing-cta-title">
        <h2 className="mx-auto max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-text-primary sm:text-6xl">
          Your next job search can feel a lot less overwhelming
        </h2>
        <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-text-dark sm:text-xl" id="closing-cta-title">
          Set up your profile, upload your resume, and start finding matches in minutes.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-overlay px-6 py-3 text-lg font-medium text-accent-foreground transition-colors hover:bg-overlay-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/login">
            Get Started <ArrowIcon />
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-muted bg-surface/70 px-6 py-3 text-lg font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/login">
            Find Your First Match
          </Link>
        </div>
      </section>
    </>
  );
}
