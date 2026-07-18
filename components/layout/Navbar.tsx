import Image from "next/image";
import Link from "next/link";
import type { JSX } from "react";

import { signOut } from "@/actions/auth";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/find-jobs", label: "Find Jobs" },
  { href: "/profile", label: "Profile" },
];

interface NavbarProps {
  authenticated?: boolean;
  showAuthAction?: boolean;
}

export function Navbar({
  authenticated = false,
  showAuthAction = true,
}: NavbarProps): JSX.Element {
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
        {authenticated && showAuthAction ? (
          <form action={signOut}>
            <button
              className="rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              type="submit"
            >
              Sign out
            </button>
          </form>
        ) : showAuthAction ? (
          <Link
            className="rounded-md bg-overlay px-5 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-overlay-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/login"
          >
            Start for free
          </Link>
        ) : null}
      </div>
    </header>
  );
}
