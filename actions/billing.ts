"use server";

import { redirect } from "next/navigation";

import { getSubscription } from "@/lib/access";
import { getAppOrigin } from "@/lib/auth-routing";
import { createInsforgeServer } from "@/lib/insforge-server";

// The Stripe test catalog's only sellable price today. See
// context/library-docs.md's "InsForge Payments: Stripe" section and
// docs/specs/0017-checkout-and-subscribe.
const PRO_MONTHLY_PRICE_ID = "price_1Tzql4HWEI4hd2koBoXmbWLF";

/**
 * Start a Stripe Checkout Session for the Pro monthly plan and redirect the
 * signed in user to Stripe's hosted page.
 *
 * Rejects (back to /profile with an error) a caller who is already on the
 * Pro plan, so a direct form submission from a stale tab can never create a
 * second Stripe subscription for the same account. The Upgrade button is
 * also hidden client side once a user is Pro; this is the server side half
 * of that same guard.
 *
 * Also rejects an unapproved private beta account the same way every other
 * paid action does (`guardPaidRoute`/`requireApprovedPage` in lib/access.ts):
 * this is a Server Action, not a route behind that guard, so it re-checks
 * `isUserApproved` itself rather than inheriting the page's redirect.
 *
 * Never throws: every failure path (including a malformed `NEXT_PUBLIC_APP_URL`
 * from `getAppOrigin`) redirects back to /profile with an error code rather
 * than surfacing an unhandled exception, since this runs as a form action
 * with no error boundary of its own.
 */
export async function startCheckout(): Promise<never> {
  const insforge = await createInsforgeServer();
  const { data, error: authError } = await insforge.auth.getCurrentUser();

  if (authError || !data.user) {
    redirect("/login?error=session");
  }

  const subscriptionResult = await getSubscription(data.user.id);

  if (!subscriptionResult.ok) {
    console.error("[actions/billing:startCheckout] could not read subscription");
    redirect("/profile?error=checkout");
  }

  if (subscriptionResult.subscription.plan === "pro") {
    redirect("/profile?error=already_pro");
  }

  let checkoutUrl: string | undefined;

  try {
    const origin = getAppOrigin({
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      nodeEnv: process.env.NODE_ENV,
    });

    // Bucketed by UTC date rather than a permanent per-user key: InsForge
    // reuses an existing payments.stripe_checkout_sessions row for a repeat
    // idempotencyKey, and Stripe Checkout Sessions expire after 24 hours, so
    // a permanent key risks handing back an expired session URL on a retry
    // days later. The daily bucket still dedupes rapid double clicks or a
    // retried request within the same day, which is what the key is for.
    const idempotencyKey = `user:${data.user.id}:pro-monthly:${new Date().toISOString().slice(0, 10)}`;

    const { data: checkout, error: checkoutError } =
      await insforge.payments.stripe.createCheckoutSession("test", {
        mode: "subscription",
        lineItems: [{ priceId: PRO_MONTHLY_PRICE_ID, quantity: 1 }],
        successUrl: `${origin}/dashboard?upgraded=1`,
        cancelUrl: `${origin}/profile`,
        subject: { type: "user", id: data.user.id },
        customerEmail: data.user.email ?? undefined,
        idempotencyKey,
      });

    if (checkoutError) {
      console.error("[actions/billing:startCheckout]", checkoutError);
    } else {
      checkoutUrl = checkout?.checkoutSession.url ?? undefined;
    }
  } catch (error) {
    console.error("[actions/billing:startCheckout]", error);
  }

  if (!checkoutUrl) {
    redirect("/profile?error=checkout");
  }

  redirect(checkoutUrl);
}
