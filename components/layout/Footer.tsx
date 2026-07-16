import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <Link className="w-fit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" href="/">
          <Image alt="JobPilot" height={42} src="/logo.png" width={124} />
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-4 text-base font-medium text-text-dark">
          <Link className="transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" href="/dashboard">
            Dashboard
          </Link>
          <Link className="transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" href="/terms">
            Terms &amp; Condition
          </Link>
        </nav>
      </div>
    </footer>
  );
}
