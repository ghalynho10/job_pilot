"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition, type JSX } from "react";

import { saveProfile, uploadResumeFile } from "@/actions/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import {
  clearStagedResume,
  getStagedResumeFileName,
  getStagedResumeKey,
  getStagedResumeServerSnapshot,
  subscribeToStagedResume,
  writeStagedResume,
} from "@/lib/staged-resume-storage";
import type { Profile } from "@/types";

interface ProfileEditorProps {
  initialProfile: Profile;
  userId: string;
}

const SAVE_SUCCESS_DISPLAY_MS = 3000;

export function ProfileEditor({ initialProfile, userId }: ProfileEditorProps): JSX.Element {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // The staged, not yet saved resume key and file name live in sessionStorage,
  // not React state: this is what makes them survive a page refresh (AC-10)
  // without a hydration mismatch. sessionStorage does not exist on the server,
  // so getStagedResumeServerSnapshot always reports null there; React swaps in
  // the real client value right after hydration, its own documented safe path
  // for this exact case, unlike reading it in a useState initializer or a
  // useEffect (both would desync the client's first render from the server's).
  const resumeKey = useSyncExternalStore(
    subscribeToStagedResume,
    useCallback(() => getStagedResumeKey(userId), [userId]),
    getStagedResumeServerSnapshot,
  );
  const resumeFileName = useSyncExternalStore(
    subscribeToStagedResume,
    useCallback(() => getStagedResumeFileName(userId), [userId]),
    getStagedResumeServerSnapshot,
  );

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
          writeStagedResume(userId, result.key, file.name);
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
        clearStagedResume(userId);
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
