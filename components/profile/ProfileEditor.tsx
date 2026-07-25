"use client";

import { useEffect, useState, useTransition, type JSX } from "react";

import { saveProfile } from "@/actions/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import type { Profile } from "@/types";

interface ProfileEditorProps {
  initialProfile: Profile;
}

const SAVE_SUCCESS_DISPLAY_MS = 3000;

export function ProfileEditor({ initialProfile }: ProfileEditorProps): JSX.Element {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!saveSuccess) return;
    const timeout = setTimeout(() => setSaveSuccess(false), SAVE_SUCCESS_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

  const handleSave = (): void => {
    setSaveError(null);
    setSaveSuccess(false);
    startTransition(async () => {
      const result = await saveProfile(profile, resumeFile);
      if (result.success) {
        setResumeFile(null);
        setSaveSuccess(true);
      } else {
        setSaveError(result.error);
      }
    });
  };

  return (
    <>
      <ResumeUpload
        onFileSelected={setResumeFile}
        selectedFileName={resumeFile?.name ?? null}
      />
      <ProfileForm
        isSaving={isPending}
        onProfileChange={setProfile}
        onSave={handleSave}
        profile={profile}
        saveError={saveError}
        saveSuccess={saveSuccess}
      />
    </>
  );
}
