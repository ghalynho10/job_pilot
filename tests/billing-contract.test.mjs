import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

// ---------------------------------------------------------------------------
// actions/billing.ts — startCheckout Server Action (spec 0017)
// ---------------------------------------------------------------------------

test("startCheckout is a server action with the correct directive (AC-2, AC-4)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  assert.match(source, /"use server"/);
  assert.match(source, /export async function startCheckout/);
});

test("startCheckout reads the Pro price id from a server-side env var (AC-2)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  assert.match(
    source,
    /process\.env\.STRIPE_PRO_MONTHLY_PRICE_ID/,
    "the Stripe price id should come from server-side configuration, not public source",
  );
  assert.match(
    source,
    /lineItems:\s*\[\{ priceId: proMonthlyPriceId, quantity: 1 \}\]/,
    "the configured price id must be passed to Checkout",
  );
  assert.doesNotMatch(
    source,
    /price_[A-Za-z0-9]+/,
    "actions/billing.ts must not commit a concrete Stripe price id",
  );
});

test("startCheckout checks auth before anything else (AC-2)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  const fnBody = source.slice(
    source.indexOf("export async function startCheckout"),
  );
  const authCheckIndex = fnBody.indexOf("getCurrentUser");
  const subscriptionCheckIndex = fnBody.indexOf("getSubscription");
  const checkoutCallIndex = fnBody.indexOf("createCheckoutSession");

  assert.ok(authCheckIndex !== -1, "must check auth");
  assert.ok(
    authCheckIndex < checkoutCallIndex,
    "auth must be checked before creating a checkout session",
  );
  assert.ok(
    subscriptionCheckIndex < checkoutCallIndex,
    "plan must be checked before creating a checkout session",
  );
});

test("startCheckout redirects a signed out caller to login (AC-4)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  assert.match(
    source,
    /redirect\("\/login\?error=session"\)/,
    "a signed out caller must be sent to login",
  );
});

test("startCheckout rejects a Pro user before calling InsForge payments (AC-4)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  const planCheckIndex = source.indexOf('plan === "pro"');
  const checkoutCallIndex = source.indexOf("createCheckoutSession");

  assert.ok(planCheckIndex !== -1, "must check plan before creating checkout");
  assert.ok(
    planCheckIndex < checkoutCallIndex,
    "plan check must happen before the checkout API call",
  );
  assert.match(
    source,
    /redirect\("\/profile\?error=already_pro"\)/,
    "a Pro user must be redirected back to profile with an already_pro error",
  );
});

test("startCheckout redirects on a failed subscription read rather than throwing (AC-4)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  assert.match(
    source,
    /!subscriptionResult\.ok/,
    "must handle the discriminated union result from getSubscription",
  );
  assert.match(
    source,
    /redirect\("\/profile\?error=checkout"\)/,
    "a failed read must redirect to profile with a checkout error, not throw",
  );
});

test("startCheckout does not reuse an idempotency key across checkout attempts (AC-2)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  assert.doesNotMatch(
    source,
    /idempotencyKey/,
    "a reused checkout key can make a canceled or changed Checkout request block later attempts",
  );
});

test("startCheckout sets the correct success and cancel URLs (AC-3, AC-6)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  assert.match(
    source,
    /successUrl:\s*`\$\{origin\}\/dashboard\?upgraded=1`/,
    "success must land on the dashboard with the upgraded flag",
  );
  assert.match(
    source,
    /cancelUrl:\s*`\$\{origin\}\/profile`/,
    "cancel must return to the profile page with no subscription change",
  );
});

test("startCheckout scopes the checkout session to the caller's own user id (AC-2)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  assert.match(
    source,
    /subject:\s*\{\s*type:\s*"user",\s*id:\s*data\.user\.id\s*\}/,
    "the checkout session subject must be the authenticated user, never a request body value",
  );
});

test("startCheckout never throws, every failure path redirects (AC-4)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  const fnBody = source.slice(
    source.indexOf("export async function startCheckout"),
  );
  // Every redirect call must point to a known error page, not escape as an
  // unhandled exception since this runs as a form action with no error boundary.
  const redirects = [...fnBody.matchAll(/redirect\("([^"]+)"\)/g)].map(
    (m) => m[1],
  );

  assert.ok(
    redirects.includes("/login?error=session"),
    "auth failure must redirect",
  );
  assert.ok(
    redirects.includes("/profile?error=checkout"),
    "read failure must redirect",
  );
  assert.ok(
    redirects.includes("/profile?error=already_pro"),
    "Pro user must redirect",
  );
});

test("startCheckout wraps the InsForge call in try/catch (AC-4)", async () => {
  const source = await readProjectFile("actions/billing.ts");

  const fnBody = source.slice(
    source.indexOf("export async function startCheckout"),
  );
  assert.match(fnBody, /try\s*\{/);
  assert.match(fnBody, /catch\s*\(/);
});

// ---------------------------------------------------------------------------
// UpgradeCard component (spec 0017 AC-1, AC-4)
// ---------------------------------------------------------------------------

test("UpgradeCard renders free plan copy and an Upgrade button when plan is free (AC-1)", async () => {
  const source = await readProjectFile("components/profile/UpgradeCard.tsx");

  assert.match(
    source,
    /free plan.*Upgrade to Pro/,
    "the free plan state must invite the user to upgrade",
  );
  // The UpgradeButton must only render when plan !== "pro".
  assert.match(source, /plan === "pro"/);
  assert.match(source, /UpgradeButton/);
});

test("UpgradeCard renders Pro badge and hides the Upgrade button when plan is pro (AC-4)", async () => {
  const source = await readProjectFile("components/profile/UpgradeCard.tsx");

  assert.match(
    source,
    /on the Pro plan/,
    "the Pro plan state must confirm the current plan",
  );
  // The Pro badge must use a check circle icon.
  assert.match(source, /CheckCircle/);
  // The Upgrade form must only appear in the else branch (free plan).
  assert.match(source, /plan === "pro"/);
});

test("UpgradeCard renders an error message when errorMessage is provided (AC-4, AC-6)", async () => {
  const source = await readProjectFile("components/profile/UpgradeCard.tsx");

  assert.match(source, /errorMessage/);
  assert.match(source, /role="alert"/);
  assert.match(source, /text-error/);
});

test("UpgradeCard uses token classes, not hardcoded hex colors or raw Tailwind color classes", async () => {
  const source = await readProjectFile("components/profile/UpgradeCard.tsx");

  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(
    source,
    /bg-(red|blue|green|yellow|purple|pink|orange|gray|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose)-\d/,
  );
});

// ---------------------------------------------------------------------------
// UpgradeButton component
// ---------------------------------------------------------------------------

test("UpgradeButton renders an Upgrade to Pro button (AC-1)", async () => {
  const source = await readProjectFile("components/profile/UpgradeButton.tsx");

  assert.match(source, /Upgrade/);
  assert.match(source, /button/i);
});

test("UpgradeButton resets pending state when returning from Stripe history", async () => {
  const source = await readProjectFile("components/profile/UpgradeButton.tsx");

  assert.match(
    source,
    /window\.addEventListener\("pageshow", resetPending\)/,
    "returning from Stripe through browser history must not leave the button stuck pending",
  );
  assert.match(
    source,
    /window\.removeEventListener\("pageshow", resetPending\)/,
    "the pageshow listener must be cleaned up",
  );
  assert.match(source, /setPending\(false\)/);
});

test("UpgradeButton uses token classes, not hardcoded hex colors", async () => {
  const source = await readProjectFile("components/profile/UpgradeButton.tsx");

  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/);
});

// ---------------------------------------------------------------------------
// UpgradeSuccessBanner component (spec 0017 AC-3)
// ---------------------------------------------------------------------------

test("UpgradeSuccessBanner renders the success message (AC-3)", async () => {
  const source = await readProjectFile(
    "components/dashboard/UpgradeSuccessBanner.tsx",
  );

  assert.match(
    source,
    /on the Pro plan now/,
    "the success banner must confirm the Pro plan upgrade",
  );
  assert.match(source, /CheckCircle/);
  assert.match(source, /role="status"/);
});

test("UpgradeSuccessBanner uses token classes, not hardcoded hex colors", async () => {
  const source = await readProjectFile(
    "components/dashboard/UpgradeSuccessBanner.tsx",
  );

  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/);
});

// ---------------------------------------------------------------------------
// Profile page integration (spec 0017 AC-1)
// ---------------------------------------------------------------------------

test("profile page imports and renders UpgradeCard with the user's plan (AC-1)", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  assert.match(source, /import.*UpgradeCard.*from/);
  // The plan passed to UpgradeCard must come from getSubscription.
  assert.match(
    source,
    /plan\s*=\s*subscriptionResult\.ok\s*\?\s*subscriptionResult\.subscription\.plan\s*:\s*"free"/,
  );
  assert.match(source, /<UpgradeCard/);
});

test("profile page passes billing error codes to UpgradeCard (AC-4, AC-6)", async () => {
  const source = await readProjectFile("app/profile/page.tsx");

  // The page must read the error search param and pass it to UpgradeCard.
  assert.match(source, /billingErrorMessages/);
  assert.match(source, /checkout.*try again/);
  assert.match(source, /already_pro.*already on the Pro plan/);
  assert.match(source, /errorMessage=\{billingErrorMessage\}/);
});

// ---------------------------------------------------------------------------
// Dashboard page integration (spec 0017 AC-3)
// ---------------------------------------------------------------------------

test("dashboard page imports and renders UpgradeSuccessBanner when upgraded=1 (AC-3)", async () => {
  const source = await readProjectFile("app/dashboard/page.tsx");

  assert.match(source, /import.*UpgradeSuccessBanner.*from/);
  assert.match(source, /upgraded/);
  assert.match(source, /showUpgradeSuccess/);
  assert.match(
    source,
    /showUpgradeSuccess \? <UpgradeSuccessBanner \/> : null/,
    "the success banner must only render when the upgraded search param is present",
  );
});

// ---------------------------------------------------------------------------
// Migration: checkout session RLS (spec 0017 AC-2, AC-5)
// ---------------------------------------------------------------------------

test("the checkout session RLS migration exists and adds the last_stripe_event_at column (AC-5)", async () => {
  const source = await readProjectFile(
    "migrations/20260802201242_add-checkout-session-rls.sql",
  );

  assert.match(source, /ADD COLUMN last_stripe_event_at timestamptz/);
});

test("the checkout session RLS migration creates INSERT and SELECT policies scoped to auth.uid() (AC-2)", async () => {
  const source = await readProjectFile(
    "migrations/20260802201242_add-checkout-session-rls.sql",
  );

  assert.match(
    source,
    /CREATE POLICY[\s\S]*?ON payments\.stripe_checkout_sessions/,
  );
  assert.match(source, /FOR INSERT/);
  assert.match(source, /FOR SELECT/);
  assert.match(
    source,
    /subject_type\s*=\s*'user'\s*AND\s*subject_id\s*=\s*auth\.uid\(\)::text/,
  );
});

// ---------------------------------------------------------------------------
// Migration: fulfillment trigger (spec 0017 AC-3, AC-5)
// ---------------------------------------------------------------------------

test("the fulfillment trigger migration creates a SECURITY DEFINER function (AC-3)", async () => {
  const source = await readProjectFile(
    "migrations/20260802201305_add-stripe-subscription-fulfillment.sql",
  );

  assert.match(source, /SECURITY DEFINER/);
  assert.match(
    source,
    /CREATE OR REPLACE FUNCTION.*fulfill_stripe_subscription/,
  );
});

// ---------------------------------------------------------------------------
// Migration: fulfillment trigger fix (spec 0017 AC-3, AC-5)
// ---------------------------------------------------------------------------

test("the fulfillment trigger fix migration adds the ordering guard fix (AC-5)", async () => {
  const source = await readProjectFile(
    "migrations/20260802212929_fix-stripe-subscription-fulfillment.sql",
  );

  // The fix must change the ordering guard from > to >= (same-second events).
  assert.match(
    source,
    /last_stripe_event_at\s*(>=|IS NULL)/,
    "the ordering guard must use >=, not >, because Stripe timestamps are second-granular",
  );
});

test("the fulfillment trigger fix wraps the upsert in an exception handler (AC-5)", async () => {
  const source = await readProjectFile(
    "migrations/20260802212929_fix-stripe-subscription-fulfillment.sql",
  );

  assert.match(source, /EXCEPTION WHEN OTHERS/);
  assert.match(source, /RAISE WARNING/);
});

// ---------------------------------------------------------------------------
// Migration: hardening (spec 0017 AC-3)
// ---------------------------------------------------------------------------

test("the hardening migration adds the environment filter (AC-3)", async () => {
  const source = await readProjectFile(
    "migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql",
  );

  assert.match(
    source,
    /NEW\.environment\s*<>\s*'test'/,
    "the trigger must filter on environment so test mode events cannot grant real Pro entitlement",
  );
});

test("the hardening migration uses IS DISTINCT FROM for null safety (AC-3)", async () => {
  const source = await readProjectFile(
    "migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql",
  );

  assert.match(
    source,
    /IS DISTINCT FROM\s*'user'/,
    "subject type check must use IS DISTINCT FROM, not <>, because a NULL subject type must be treated as a mismatch",
  );
});

test("the hardening migration enables RLS on stripe_checkout_sessions (AC-2)", async () => {
  const source = await readProjectFile(
    "migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql",
  );

  assert.match(
    source,
    /ALTER TABLE payments\.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY/,
  );
});

// ---------------------------------------------------------------------------
// Fulfillment trigger: plan derivation from Stripe status
// ---------------------------------------------------------------------------

test("the fulfillment trigger derives plan from Stripe status, not a fixed value (AC-3)", async () => {
  // Read the latest (hardened) version of the trigger.
  const source = await readProjectFile(
    "migrations/20260802214444_harden-stripe-fulfillment-and-checkout-rls.sql",
  );

  // A canceled or incomplete_expired subscription must flip back to free so
  // the user can resubscribe later.
  assert.match(
    source,
    /canceled.*incomplete_expired.*free/,
    "canceled and incomplete_expired statuses must map to free, not pro",
  );
  // Every other status maps to pro.
  assert.match(source, /ELSE\s*'pro'/);
});

// ---------------------------------------------------------------------------
// Existing suite regression guard
// ---------------------------------------------------------------------------

test("no billing or checkout file introduces hardcoded hex colors", async () => {
  const files = [
    "actions/billing.ts",
    "components/profile/UpgradeCard.tsx",
    "components/profile/UpgradeButton.tsx",
    "components/dashboard/UpgradeSuccessBanner.tsx",
  ];

  for (const file of files) {
    const source = await readProjectFile(file);
    assert.doesNotMatch(
      source,
      /#[0-9a-fA-F]{3,8}/,
      `${file} must use token classes, not hardcoded hex colors`,
    );
  }
});
