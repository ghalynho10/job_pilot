import Image from "next/image";

export function Testimonial() {
  return (
    <section className="bg-surface border-y border-border py-24 px-6">
      <div className="max-w-[760px] mx-auto flex flex-col items-center text-center gap-8">
        {/* Quote mark */}
        <div className="text-[72px] leading-none text-accent font-serif select-none -mb-4">
          &ldquo;
        </div>

        <blockquote className="text-[22px] font-medium leading-[1.6] text-text-primary">
          I used to spend my evenings copy-pasting resumes. Now I open my dashboard
          to see interviews waiting. It feels like cheating. Had 3 offers on the table
          simultaneously.
        </blockquote>

        {/* Author */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border">
            <Image
              src="/images/user-icon.png"
              alt="Alex D."
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Alex D.</p>
            <p className="text-sm text-text-muted">Senior Software Engineer</p>
          </div>
        </div>
      </div>
    </section>
  );
}
