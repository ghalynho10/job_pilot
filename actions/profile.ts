"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createInsforgeServer } from "@/lib/insforge-server";
import { deriveProfileCompletion } from "@/lib/profile-completion";
import { mapProfileToRow } from "@/lib/profile-mapping";
import { createPostHogServer } from "@/lib/posthog-server";
import type { ActionResult, Profile, ProfileWritePayload } from "@/types";

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;

export async function uploadResumeFile(
  file: File,
  previousUnsavedKey?: string,
): Promise<ActionResult<{ key: string }>> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } =
      await insforge.auth.getCurrentUser();

    if (authError || !authData.user) {
      return {
        success: false,
        error: "You must be signed in to upload a resume.",
      };
    }

    if (file.type !== "application/pdf") {
      return { success: false, error: "Please upload a PDF file." };
    }
    if (file.size === 0) {
      return { success: false, error: "The selected file is empty." };
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      return {
        success: false,
        error: "File is larger than 5MB. Please upload a smaller PDF.",
      };
    }

    const userId = authData.user.id;
    const key = `${userId}/${randomUUID()}.pdf`;
    const { data: uploadData, error: uploadError } = await insforge.storage
      .from("resumes")
      .upload(key, file);

    if (uploadError || !uploadData) {
      console.error("[actions/profile:uploadResumeFile]", uploadError);
      return {
        success: false,
        error: "Failed to upload resume. Please try again.",
      };
    }

    if (previousUnsavedKey) {
      const { error: removeError } = await insforge.storage
        .from("resumes")
        .remove(previousUnsavedKey);

      if (removeError) {
        console.error("[actions/profile:uploadResumeFile]", removeError);
      }
    }

    return { success: true, key: uploadData.key };
  } catch (error) {
    console.error("[actions/profile:uploadResumeFile]", error);
    return { success: false, error: "Failed to upload resume. Please try again." };
  }
}

export async function saveProfile(
  profile: Profile,
  resumeKey: string | null,
): Promise<ActionResult<{ isComplete: boolean; resumeKey?: string }>> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } =
      await insforge.auth.getCurrentUser();

    if (authError || !authData.user) {
      return {
        success: false,
        error: "You must be signed in to save your profile.",
      };
    }

    const userId = authData.user.id;
    const email = authData.user.email;

    const { data: existingRow, error: readError } = await insforge.database
      .from("profiles")
      .select("resume_pdf_url, is_complete")
      .eq("id", userId)
      .maybeSingle();

    if (readError) {
      console.error("[actions/profile:saveProfile]", readError);
      return { success: false, error: "Failed to save profile. Please try again." };
    }

    const previousResumeKey: string | null = existingRow?.resume_pdf_url ?? null;
    const wasComplete: boolean = existingRow?.is_complete ?? false;

    const baseRow = mapProfileToRow(profile, userId, email);
    const completion = deriveProfileCompletion({
      fullName: baseRow.full_name ?? "",
      phone: baseRow.phone ?? "",
      location: baseRow.location ?? "",
      currentTitle: baseRow.current_title ?? "",
      experienceLevel: baseRow.experience_level ?? "",
      yearsExperience: baseRow.years_experience,
      skills: baseRow.skills ?? [],
      workExperience: baseRow.work_experience ?? [],
      education: baseRow.education ?? {
        highestDegree: "",
        fieldOfStudy: "",
        institutionName: "",
        graduationYear: "",
      },
      jobTitlesSeeking: baseRow.job_titles_seeking ?? [],
    });
    const isComplete = completion.missingFields.length === 0;

    const payload: ProfileWritePayload = {
      ...baseRow,
      is_complete: isComplete,
      ...(resumeKey ? { resume_pdf_url: resumeKey } : {}),
    };

    const { error: writeError } = await insforge.database
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (writeError) {
      console.error("[actions/profile:saveProfile]", writeError);
      if (resumeKey) {
        return {
          success: false,
          error:
            "Resume uploaded but couldn't be saved to your profile. Please try again.",
        };
      }
      return { success: false, error: "Failed to save profile. Please try again." };
    }

    if (resumeKey && previousResumeKey && previousResumeKey !== resumeKey) {
      const { error: removeError } = await insforge.storage
        .from("resumes")
        .remove(previousResumeKey);

      if (removeError) {
        console.error("[actions/profile:saveProfile]", removeError);
      }
    }

    if (isComplete && !wasComplete) {
      const posthog = createPostHogServer();
      posthog.capture({
        distinctId: userId,
        event: "profile_completed",
        properties: { userId },
      });
      await posthog.shutdown();
    }

    revalidatePath("/profile");
    return { success: true, isComplete, resumeKey: resumeKey ?? undefined };
  } catch (error) {
    console.error("[actions/profile:saveProfile]", error);
    return { success: false, error: "Failed to save profile. Please try again." };
  }
}
