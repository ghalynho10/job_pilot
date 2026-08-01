import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { JSX } from "react";

import { signOut } from "@/actions/auth";
import { isUserApproved } from "@/lib/access";
import { createInsforgeServer } from "@/lib/insforge-server";

export const metadata: Metadata = {
  title: "Private beta | JobPilot",
  description: "JobPilot is currently open to approved accounts only.",
};

// The screen an approved user never sees. Deliberately built without the shared
// Navbar: that component always renders the Dashboard, Find Jobs, and Profile
// links whatever props it is given, and this page must expose no way into the
// app it is holding the visitor out of.
//
// This page is the mirror image of the other protected pages. They call
// requireApprovedPage and bounce an unapproved user here; this one bounces an
// approved user out to the dashboard, so the redirect can never bounce between
// the two and strand somebody in a loop.
export default async function PrivateBetaPage(): Promise<JSX.Element> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

  if (await isUserApproved(insforge, data.user.id)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center px-6">
          <Link
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            href="/"
          >
            <Image alt="JobPilot" height={42} priority src="/logo.png" width={124} />
          </Link>
        </div>
      </header>

      <main
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16"
        id="main-content"
      >
        <div className="rounded-md border border-border bg-surface p-8 shadow-sm sm:p-10">
          <p className="mb-3 text-base font-semibold text-accent">Private beta</p>
          <h1 className="text-3xl font-semibold text-text-primary">
            Your account is not approved yet
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            JobPilot searches live job boards and researches companies for you, and
            each of those runs costs real money. While paid plans are being
            finished, access is granted by hand to a small number of accounts.
          </p>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            If you are here for a demo, ask for access and mention the email below.
            Nothing else is needed from you, and you can close this page.
          </p>

          <div className="mt-8 rounded-md border border-border bg-surface-secondary px-4 py-3">
            <p className="text-sm text-text-secondary">Signed in as</p>
            <p className="mt-1 break-words text-base font-medium text-text-primary">
              {data.user.email}
            </p>
          </div>

          <form action={signOut} className="mt-6">
            <button
              className="rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
