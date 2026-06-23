import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BottomCta() {
  return (
    <section
      className="py-28 px-6 flex flex-col items-center text-center"
      style={{
        background:
          "linear-gradient(135deg, #7c5cfc 0%, #9b7dff 40%, #b8a0ff 70%, #d4c5ff 100%)",
      }}
    >
      <div className="max-w-[640px] mx-auto flex flex-col items-center gap-6">
        <h2 className="text-[40px] font-bold leading-tight text-white">
          Your next job search can feel a lot less overwhelming.
        </h2>
        <p className="text-lg text-white/80 leading-relaxed">
          Set up your profile once, let JobPilot do the work, and show up to every
          application fully prepared.
        </p>

        <div className="flex items-center gap-4 mt-2">
          <Link
            href="/login"
            className="bg-white text-text-primary text-sm font-medium px-6 py-3 rounded-lg hover:opacity-95 transition-opacity"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 text-white/90 text-sm font-medium px-6 py-3 rounded-lg border border-white/30 hover:bg-white/10 transition-colors"
          >
            Find Your First Match
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
