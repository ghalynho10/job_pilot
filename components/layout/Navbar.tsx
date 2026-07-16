import Image from "next/image";
import Link from "next/link";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/find-jobs", label: "Find Jobs" },
  { href: "/profile", label: "Profile" },
];

export function Navbar() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6">
        <Link className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" href="/">
          <Image alt="JobPilot" height={42} priority src="/logo.png" width={124} />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-10 md:flex">
          {navigationItems.map((item) => (
            <Link
              className="text-base font-medium text-text-dark transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          className="rounded-md bg-overlay px-5 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-overlay-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="/login"
        >
          Start for free
        </Link>
      </div>
    </header>
  );
}
