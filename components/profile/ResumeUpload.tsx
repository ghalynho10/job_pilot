"use client";

import { FileText, Sparkles, UploadCloud } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type JSX,
} from "react";

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;

interface ResumeUploadProps {
  canExtract: boolean;
  canGenerate: boolean;
  extractError: string | null;
  generateError: string | null;
  generateHint: string | null;
  generateSuccess: boolean;
  isExtracting: boolean;
  isFetchingViewLink: boolean;
  isGenerating: boolean;
  isUploading: boolean;
  onExtract: () => void;
  onFileSelected: (file: File) => void;
  onGenerate: () => void;
  onViewResume: () => void;
  uploadedFileName: string | null;
  uploadError: string | null;
  viewLinkError: string | null;
}

export function ResumeUpload({
  canExtract,
  canGenerate,
  extractError,
  generateError,
  generateHint,
  generateSuccess,
  isExtracting,
  isFetchingViewLink,
  isGenerating,
  isUploading,
  onExtract,
  onFileSelected,
  onGenerate,
  onViewResume,
  uploadedFileName,
  uploadError,
  viewLinkError,
}: ResumeUploadProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isBusy = isUploading || isExtracting || isGenerating;

  const handleFile = (file: File): void => {
    if (file.type !== "application/pdf") {
      setValidationError("Please select a PDF file.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setValidationError("File is larger than 5MB. Please select a smaller PDF.");
      return;
    }
    setValidationError(null);
    onFileSelected(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handleFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    if (isBusy) return;
    setIsDraggingOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    setIsDraggingOver(false);
    if (isBusy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const displayError = uploadError ?? validationError;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">Resume</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Select or drag in a resume to save with your profile, or generate a
        new tailored one from your details below.
      </p>

      <button
        className={`mt-4 flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 ${
          isDraggingOver
            ? "border-accent bg-accent-muted"
            : "border-border-muted bg-surface-secondary"
        }`}
        disabled={isBusy}
        onClick={() => fileInputRef.current?.click()}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        type="button"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-surface shadow-sm">
          <UploadCloud aria-hidden="true" className="size-5 text-accent" />
        </span>
        <span className="text-sm font-semibold text-text-primary">
          {uploadedFileName ??
            (isUploading ? "Uploading…" : "Click to upload or drag and drop")}
        </span>
        <span className="text-xs text-text-muted">
          {isUploading
            ? "Hold on, this only takes a moment."
            : uploadedFileName
              ? "Uploaded. Click Save Profile below to add it to your profile."
              : "PDF formatting only. Maximum file size 5MB."}
        </span>
        <span className="mt-1 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary">
          Select Resume
        </span>
      </button>
      {displayError ? (
        <p className="mt-2 text-xs text-error" role="alert">
          {displayError}
        </p>
      ) : null}
      <input
        accept="application/pdf"
        className="sr-only"
        disabled={isBusy}
        onChange={handleInputChange}
        ref={fileInputRef}
        type="file"
      />

      {canExtract ? (
        <div className="mt-4">
          <button
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            disabled={isBusy}
            onClick={onExtract}
            type="button"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {isExtracting ? "Extracting…" : "Extract from Resume"}
          </button>
          {extractError ? (
            <p className="mt-2 text-xs text-error" role="alert">
              {extractError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 border-t border-border pt-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-text-secondary">
            Need a fresh document based on the fields below?
          </p>
          <button
            className="flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            disabled={isBusy || !canGenerate}
            onClick={onGenerate}
            type="button"
          >
            <FileText aria-hidden="true" className="size-4" />
            {isGenerating ? "Generating…" : "Generate Resume from Profile"}
          </button>
        </div>
        {generateHint ? (
          <p className="mt-2 text-xs text-text-muted">{generateHint}</p>
        ) : null}
        {generateError ? (
          <p className="mt-2 text-xs text-error" role="alert">
            {generateError}
          </p>
        ) : null}
        {generateSuccess ? (
          <div className="mt-2 flex flex-col items-start gap-1">
            <p className="text-xs text-text-secondary">Your resume is ready.</p>
            <button
              className="text-xs font-medium text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              disabled={isFetchingViewLink}
              onClick={onViewResume}
              type="button"
            >
              {isFetchingViewLink ? "Preparing link…" : "View resume"}
            </button>
            {viewLinkError ? (
              <p className="text-xs text-error" role="alert">
                {viewLinkError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
