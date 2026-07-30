"use client";

import { useRouter } from "next/navigation";
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
import type { ActionResult, ExtractedProfileFields, Profile } from "@/types";

interface ProfileEditorProps {
  initialProfile: Profile;
  userId: string;
}

const SAVE_SUCCESS_DISPLAY_MS = 3000;

export function ProfileEditor({ initialProfile, userId }: ProfileEditorProps): JSX.Element {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [isFetchingViewLink, setIsFetchingViewLink] = useState(false);
  const [viewLinkError, setViewLinkError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canGenerate = profile.fullName.trim().length > 0 && profile.workExperience.length > 0;
  // The server always generates from the last saved profile row (AC-2), never
  // from unsaved form state. If the form is edited but not yet saved, warn
  // here rather than let the user click Generate and either get rejected (an
  // incomplete unsaved edit) or get a PDF that silently ignores their latest
  // changes (a complete unsaved edit).
  const isProfileDirty = JSON.stringify(profile) !== JSON.stringify(initialProfile);
  const generateHint = !canGenerate
    ? "Add your full name and at least one work experience entry to generate a resume."
    : isProfileDirty
      ? "Save your profile first so Generate Resume uses your latest changes."
      : null;

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

  const handleExtract = (): void => {
    if (!resumeKey) return;
    setExtractError(null);
    setIsExtracting(true);

    void fetch("/api/resume/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeKey }),
    })
      .then((response) => response.json() as Promise<ActionResult<{ data: ExtractedProfileFields }>>)
      .then((result) => {
        setIsExtracting(false);
        if (result.success) {
          setProfile((prev) => ({ ...prev, ...result.data }));
        } else {
          setExtractError(result.error);
        }
      })
      .catch(() => {
        setIsExtracting(false);
        setExtractError("Something went wrong extracting your profile. Please try again.");
      });
  };

  const handleGenerate = (): void => {
    setGenerateError(null);
    setGenerateSuccess(false);
    setIsGenerating(true);

    void fetch("/api/resume/generate", { method: "POST" })
      .then((response) => response.json() as Promise<ActionResult>)
      .then((result) => {
        setIsGenerating(false);
        if (result.success) {
          setGenerateSuccess(true);
          router.refresh();
        } else {
          setGenerateError(result.error);
        }
      })
      .catch(() => {
        setIsGenerating(false);
        setGenerateError("Something went wrong generating your resume. Please try again.");
      });
  };

  const handleViewResume = (): void => {
    setViewLinkError(null);
    setIsFetchingViewLink(true);

    void fetch("/api/resume/signed-url")
      .then((response) => response.json() as Promise<ActionResult<{ url: string }>>)
      .then((result) => {
        setIsFetchingViewLink(false);
        if (result.success) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        } else {
          setViewLinkError(result.error);
        }
      })
      .catch(() => {
        setIsFetchingViewLink(false);
        setViewLinkError("Could not open your resume. Please try again.");
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
        canExtract={resumeKey !== null}
        canGenerate={canGenerate}
        extractError={extractError}
        generateError={generateError}
        generateHint={generateHint}
        generateSuccess={generateSuccess}
        isExtracting={isExtracting}
        isFetchingViewLink={isFetchingViewLink}
        isGenerating={isGenerating}
        isUploading={isUploading}
        onExtract={handleExtract}
        onFileSelected={handleFileSelected}
        onGenerate={handleGenerate}
        onViewResume={handleViewResume}
        uploadedFileName={resumeFileName}
        uploadError={uploadError}
        viewLinkError={viewLinkError}
      />
      <ProfileForm
        isSaving={isPending}
        onProfileChange={setProfile}
        onSave={handleSave}
        profile={profile}
        saveDisabled={isUploading || isExtracting || isGenerating}
        saveError={saveError}
        saveSuccess={saveSuccess}
      />
    </>
  );
}
