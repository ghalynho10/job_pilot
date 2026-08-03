import { redirect } from "next/navigation";
import type { JSX } from "react";

import { CompletionIndicator } from "@/components/profile/CompletionIndicator";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { UpgradeCard } from "@/components/profile/UpgradeCard";
import { Navbar } from "@/components/layout/Navbar";
import { getSubscription } from "@/lib/access";
import { createInsforgeServer } from "@/lib/insforge-server";
import { deriveProfileCompletion } from "@/lib/profile-completion";
import {
  buildEmptyProfile,
  mapProfileRowToProfile,
} from "@/lib/profile-mapping";
import type { ProfileRow } from "@/types";

const billingErrorMessages: Record<string, string> = {
  checkout: "Something went wrong starting checkout. Please try again.",
  already_pro: "You're already on the Pro plan.",
};

type ProfilePageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function ProfilePage({
  searchParams,
}: ProfilePageProps): Promise<JSX.Element> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

  const { error: billingErrorCode } = await searchParams;
  const resolvedBillingErrorCode = Array.isArray(billingErrorCode)
    ? billingErrorCode[0]
    : billingErrorCode;
  const billingErrorMessage = resolvedBillingErrorCode
    ? billingErrorMessages[resolvedBillingErrorCode]
    : undefined;

  const subscriptionResult = await getSubscription(data.user.id);
  if (!subscriptionResult.ok) {
    console.error("[app/profile] could not read subscription");
  }
  const plan = subscriptionResult.ok
    ? subscriptionResult.subscription.plan
    : "free";

  const { data: row, error: profileError } = await insforge.database
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    console.error("[app/profile]", profileError);
  }

  const profile = row ? mapProfileRowToProfile(row) : buildEmptyProfile(data.user.email);

  const completion = deriveProfileCompletion({
    fullName: row?.full_name ?? "",
    phone: row?.phone ?? "",
    location: row?.location ?? "",
    currentTitle: row?.current_title ?? "",
    experienceLevel: row?.experience_level ?? "",
    yearsExperience: row?.years_experience ?? null,
    skills: row?.skills ?? [],
    workExperience: row?.work_experience ?? [],
    education: row?.education ?? {
      highestDegree: "",
      fieldOfStudy: "",
      institutionName: "",
      graduationYear: "",
    },
    jobTitlesSeeking: row?.job_titles_seeking ?? [],
  });

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <a
        className="sr-only fixed start-4 top-4 z-50 rounded-md bg-surface px-4 py-2 text-text-primary shadow-sm focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        href="#main-content"
      >
        Skip to content
      </a>
      <Navbar authenticated showAuthAction={false} />
      <main
        className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 sm:px-8"
        id="main-content"
      >
        <CompletionIndicator completion={completion} />
        <UpgradeCard errorMessage={billingErrorMessage} plan={plan} />
        <ProfileEditor initialProfile={profile} userId={data.user.id} />
      </main>
    </div>
  );
}
