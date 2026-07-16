import Image from "next/image";
import Link from "next/link";

function ArrowIcon() {
  return <span aria-hidden="true">▶</span>;
}

export function Hero() {
  return (
    <section className="mx-auto max-w-[1440px] px-6 pt-20 sm:pt-24">
      <div className="hero-gradient overflow-hidden border border-border">
        <div className="mx-auto flex min-h-[560px] max-w-4xl flex-col items-center justify-center px-6 py-20 text-center sm:px-12">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] text-text-black sm:text-6xl lg:text-7xl">
            Job hunting is hard.
            <br />
            Your tools shouldn’t be.
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-text-secondary sm:text-xl">
            Stop applying blind. JobPilot finds the jobs, researches the companies, and gives you everything you need to stand out.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-overlay px-6 py-3 text-lg font-medium text-accent-foreground transition-colors hover:bg-overlay-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/login">
              Get Started <ArrowIcon />
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-muted bg-surface/60 px-6 py-3 text-lg font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/login">
              Find Your First Match
            </Link>
          </div>
        </div>
      </div>
      <div className="overflow-hidden border-x border-b border-border bg-surface-secondary px-4 pt-12 sm:px-10 sm:pt-16">
        <div className="mx-auto max-w-[1180px] overflow-hidden rounded-t-[28px] border border-border bg-surface shadow-xl">
          <Image
            alt="JobPilot dashboard with job match statistics and company research activity"
            className="block h-auto w-full"
            height={2416}
            priority
            sizes="(max-width: 1440px) 92vw, 1180px"
            src="/images/dashboard-demo.png"
            width={4788}
          />
        </div>
      </div>
    </section>
  );
}
