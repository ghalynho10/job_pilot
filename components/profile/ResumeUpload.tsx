"use client";

import { FileText, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent, type JSX } from "react";

export function ResumeUpload(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    setIsDraggingOver(false);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">Resume</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Upload an existing resume to auto-fill the profile, or generate a new
        tailored one from your details below.
      </p>

      <button
        className={`mt-4 flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isDraggingOver
            ? "border-accent bg-accent-muted"
            : "border-border-muted bg-surface-secondary"
        }`}
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
          Click to upload or drag and drop
        </span>
        <span className="text-xs text-text-muted">
          PDF formatting only. Maximum file size 5MB.
        </span>
        <span className="mt-1 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary">
          Select Resume
        </span>
      </button>
      <input
        accept="application/pdf"
        className="sr-only"
        ref={fileInputRef}
        type="file"
      />

      <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <p className="text-sm text-text-secondary">
          Need a fresh document based on the fields below?
        </p>
        <button
          className="flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          type="button"
        >
          <FileText aria-hidden="true" className="size-4" />
          Generate Resume from Profile
        </button>
      </div>
    </section>
  );
}
