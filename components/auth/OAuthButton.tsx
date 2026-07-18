"use client";

import type { JSX } from "react";
import { useFormStatus } from "react-dom";
import posthog from "posthog-js";

interface OAuthButtonProps {
  provider: "Google" | "GitHub";
}

export function OAuthButton({ provider }: OAuthButtonProps): JSX.Element {
  const { pending } = useFormStatus();

  return (
    <button
      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-text-muted"
      disabled={pending}
      onClick={() => posthog.capture("oauth_sign_in_started", { provider: provider.toLowerCase() })}
      type="submit"
    >
      {provider === "Google" ? (
        <svg
          aria-hidden="true"
          className="size-5 shrink-0"
          viewBox="0 0 24 24"
        >
          <path
            d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
            fill="currentColor"
          />
          <path
            d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.77-5.61-4.14H3.04v2.62A10 10 0 0 0 12 22Z"
            fill="currentColor"
            opacity=".8"
          />
          <path
            d="M6.39 13.86A6 6 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.48l3.35-2.62Z"
            fill="currentColor"
            opacity=".6"
          />
          <path
            d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z"
            fill="currentColor"
            opacity=".4"
          />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          className="size-5 shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49v-1.91c-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.13-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.95c.85 0 1.7.12 2.5.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.8c0 .27.18.59.69.49A10.22 10.22 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
        </svg>
      )}
      <span aria-live="polite">
        {pending ? `Connecting to ${provider}` : `Continue with ${provider}`}
      </span>
    </button>
  );
}
