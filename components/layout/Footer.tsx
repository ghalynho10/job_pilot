import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-surface border-t border-border py-10 px-6">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="JobPilot" width={120} height={34} />
        </Link>

        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Dashboard
          </Link>
          <Link href="/find-jobs" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Find Jobs
          </Link>
          <Link href="/profile" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Profile
          </Link>
          <Link href="/login" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Login
          </Link>
        </div>

        <p className="text-sm text-text-muted">
          © {new Date().getFullYear()} JobPilot. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
