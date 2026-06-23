import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="bg-surface pt-20 pb-0 px-6 flex flex-col items-center text-center overflow-hidden">
      <div className="max-w-[760px] mx-auto flex flex-col items-center">
        {/* Badge */}
        <div className="flex items-center gap-2 bg-accent-muted border border-accent-light text-accent text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <Sparkles size={14} />
          AI-Powered Job Hunting Assistant
        </div>

        {/* Heading */}
        <h1 className="text-[56px] font-bold leading-[1.1] tracking-tight text-text-primary mb-6">
          Job hunting is hard.
          <br />
          <span className="text-accent">Your tools</span> shouldn&apos;t be.
        </h1>

        {/* Subtext */}
        <p className="text-lg text-text-secondary leading-relaxed max-w-[560px] mb-10">
          JobPilot finds relevant jobs, scores each one against your profile with GPT-4o,
          researches companies automatically, and gets you ready to apply — in minutes, not hours.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4 mb-16">
          <Link
            href="/login"
            className="bg-overlay-dark text-accent-foreground text-sm font-medium px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm font-medium text-text-primary border border-border px-6 py-3 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            Find Your First Match
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Dashboard screenshot */}
      <div className="w-full max-w-[1100px] mx-auto rounded-t-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-border border-b-0">
        <Image
          src="/images/dashboard-demo.png"
          alt="JobPilot dashboard preview"
          width={1100}
          height={660}
          className="w-full h-auto block"
          priority
        />
      </div>
    </section>
  );
}
