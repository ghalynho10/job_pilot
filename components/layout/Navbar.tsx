"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Find Jobs", href: "/find-jobs" },
  { label: "Profile", href: "/profile" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="w-full bg-surface border-b border-border h-16 flex items-center px-6 shrink-0">
      <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="JobPilot" width={130} height={36} priority />
        </Link>

        <nav className="flex items-center gap-8">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  isActive ? "text-accent" : "text-text-dark hover:text-text-primary"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/login"
          className="bg-overlay-dark text-accent-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          Start for free
        </Link>
      </div>
    </header>
  );
}
