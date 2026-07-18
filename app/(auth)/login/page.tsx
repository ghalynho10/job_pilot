import type { Metadata } from "next";
import Image from "next/image";
import type { JSX } from "react";

import {
  signInWithGitHub,
  signInWithGoogle,
} from "@/actions/auth";
import { OAuthButton } from "@/components/auth/OAuthButton";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Sign in | JobPilot",
  description: "Sign in to JobPilot with Google or GitHub.",
};

const errorMessages: Record<string, string> = {
  oauth: "We could not finish signing you in. Please try again.",
  oauth_start: "We could not connect to that provider. Please try again.",
  session: "Your session has expired. Please sign in again.",
  sign_out: "We could not fully sign you out. Please try again.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps): Promise<JSX.Element> {
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  const errorMessage = errorCode ? errorMessages[errorCode] : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-primary">
      <a
        className="sr-only fixed start-4 top-4 z-50 rounded-md bg-surface px-4 py-2 text-text-primary shadow-sm focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        href="#sign-in"
      >
        Skip to sign in
      </a>
      <Navbar showAuthAction={false} />

      <main
        className="grid flex-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]"
        id="main-content"
      >
        <section className="hero-gradient hidden border-e border-border p-10 lg:flex lg:flex-col lg:justify-center xl:p-16">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-12">
            <div className="max-w-xl">
              <p className="mb-4 text-base font-semibold text-accent">
                Your focused job search workspace
              </p>
              <h2 className="text-4xl font-semibold leading-tight text-text-primary xl:text-5xl">
                Spend less time searching. Apply with more confidence.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-8 text-text-secondary">
                JobPilot finds relevant roles, explains why they fit, and
                prepares the company research you need before you apply.
              </p>
            </div>

            <figure className="overflow-hidden rounded-md border border-border bg-surface p-3 shadow-sm">
              <Image
                alt="JobPilot dashboard showing job match analytics"
                className="h-auto w-full rounded-sm"
                height={760}
                priority
                src="/images/dashboard-demo.png"
                width={1200}
              />
              <figcaption className="sr-only">
                A preview of the JobPilot dashboard
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          className="flex flex-col px-6 py-8 sm:px-10 lg:px-14 xl:px-20"
          id="sign-in"
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            <div className="mb-8">
              <p className="mb-3 text-base font-semibold text-accent">
                Welcome to JobPilot
              </p>
              <h1 className="text-3xl font-semibold text-text-primary">
                Sign in to your account
              </h1>
              <p className="mt-3 text-base leading-7 text-text-secondary">
                Choose the account you want to use for your job search.
              </p>
            </div>

            {errorMessage ? (
              <div
                className="mb-5 rounded-md border border-error bg-surface px-4 py-3 text-base text-error"
                role="alert"
              >
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <form action={signInWithGoogle}>
                <OAuthButton provider="Google" />
              </form>
              <form action={signInWithGitHub}>
                <OAuthButton provider="GitHub" />
              </form>
            </div>
          </div>

          <p className="text-center text-sm text-text-muted">
            Secure authentication powered by InsForge
          </p>
        </section>
      </main>
    </div>
  );
}
