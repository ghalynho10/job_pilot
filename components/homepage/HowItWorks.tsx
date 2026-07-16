import Image from "next/image";

const jobSearchPoints = [
  ["Find jobs that actually fit", "Search by title and location or paste a job link. Get matched roles you can quickly scan."],
  ["Know the Company Before You Apply", "Stop guessing what a company is about. JobPilot browses their site and gives you everything you need to apply with confidence."],
  ["Keep track of every application", "Keep a clear view of every job you’ve found, tailored. Your activity and progress all stay in one simple place."],
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1440px] border-x border-border bg-surface" aria-labelledby="job-search-title">
      <div className="grid lg:grid-cols-2">
        <div className="border-b border-border px-8 py-20 lg:border-b-0 lg:border-e lg:px-16 lg:py-24">
          <h2 className="max-w-md text-5xl font-semibold tracking-[-0.05em] text-text-primary sm:text-6xl" id="job-search-title">
            Manage Your Job Search With Ease
          </h2>
        </div>
        <div className="bg-surface-muted px-6 py-10 sm:px-10 lg:flex lg:items-center lg:px-10">
          <Image
            alt="Job match list displaying companies, scores, salaries, and application sources"
            className="h-auto w-full rounded-xl border border-border shadow-sm"
            height={1778}
            sizes="(max-width: 1024px) 88vw, 620px"
            src="/images/jobs-lists.png"
            width={2364}
          />
        </div>
      </div>
      <div className="grid border-t border-border lg:grid-cols-2">
        <div className="lg:col-start-1">
          {jobSearchPoints.map(([title, description], index) => (
            <article className={`border-b border-border px-8 py-8 last:border-b-0 lg:px-16 ${index === 0 ? "border-s-2 border-s-accent" : ""}`} key={title}>
              <h3 className="text-2xl font-semibold tracking-[-0.03em] text-text-primary">{title}</h3>
              <p className="mt-4 max-w-xl text-lg leading-8 text-text-secondary">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
