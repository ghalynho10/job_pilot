"use client";

import { useEffect, useState, useTransition, type JSX } from "react";

import { saveProfile, uploadResumeFile } from "@/actions/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import type { Profile } from "@/types";

interface ProfileEditorProps {
  initialProfile: Profile;
}

const SAVE_SUCCESS_DISPLAY_MS = 3000;

export function ProfileEditor({ initialProfile }: ProfileEditorProps): JSX.Element {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [resumeKey, setResumeKey] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!saveSuccess) return;
    const timeout = setTimeout(() => setSaveSuccess(false), SAVE_SUCCESS_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

  const handleFileSelected = (file: File): void => {
    setUploadError(null);
    setIsUploading(true);
    const previousUnsavedKey = resumeKey ?? undefined;

    void uploadResumeFile(file, previousUnsavedKey)
      .then((result) => {
        setIsUploading(false);
        if (result.success) {
          setResumeKey(result.key);
          setResumeFileName(file.name);
        } else {
          setUploadError(result.error);
        }
      })
      .catch(() => {
        setIsUploading(false);
        setUploadError("Failed to upload resume. Please try again.");
      });
  };

  const handleSave = (): void => {
    setSaveError(null);
    setSaveSuccess(false);
    startTransition(async () => {
      const result = await saveProfile(profile, resumeKey);
      if (result.success) {
        setResumeKey(null);
        setResumeFileName(null);
        setSaveSuccess(true);
      } else {
        setSaveError(result.error);
      }
    });
  };

  return (
    <>
      <ResumeUpload
        isUploading={isUploading}
        onFileSelected={handleFileSelected}
        uploadedFileName={resumeFileName}
        uploadError={uploadError}
      />
      <ProfileForm
        isSaving={isPending}
        onProfileChange={setProfile}
        onSave={handleSave}
        profile={profile}
        saveDisabled={isUploading}
        saveError={saveError}
        saveSuccess={saveSuccess}
      />
    </>
  );
}
