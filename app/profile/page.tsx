import { redirect } from "next/navigation";
import type { JSX } from "react";

import { CompletionIndicator } from "@/components/profile/CompletionIndicator";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { Navbar } from "@/components/layout/Navbar";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { Profile, ProfileCompletion } from "@/types";

const mockProfile: Profile = {
  fullName: "Faizan Ali",
  email: "faizan@jsmastery.pro",
  phone: "",
  location: "",
  linkedinUrl: "https://linkedin.com/in/faizan",
  portfolioUrl: "https://github.com/jsmastery",
  workAuthorization: "citizen",
  currentTitle: "Frontend Engineer",
  experienceLevel: "junior",
  yearsExperience: 4,
  skills: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
  industries: [],
  workExperience: [
    {
      company: "Vercel",
      jobTitle: "Frontend Engineer",
      startDate: "2022-01",
      endDate: "",
      currentlyWorkingHere: true,
      keyResponsibilities:
        "Built Next.js features and optimized web vitals. Led a team of 3 developers.",
    },
  ],
  education: {
    highestDegree: "high_school",
    fieldOfStudy: "Computer Science",
    institutionName: "",
    graduationYear: "",
  },
  jobTitlesSeeking: "Frontend Engineer, React Developer",
  remotePreference: "any",
  salaryExpectation: "",
  preferredLocations: "",
};

const mockCompletion: ProfileCompletion = {
  percentage: 70,
  missingFields: ["Phone", "Location", "Education"],
};

export default async function ProfilePage(): Promise<JSX.Element> {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

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
        <CompletionIndicator completion={mockCompletion} />
        <ResumeUpload />
        <ProfileForm initialProfile={mockProfile} />
      </main>
    </div>
  );
}
