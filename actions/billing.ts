"use server";

import { redirect } from "next/navigation";

import { getSubscription, isUserApproved } from "@/lib/access";
import { getAppOrigin } from "@/lib/auth-routing";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ActionResult } from "@/types";

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
 * Never throws: every failure path (including a malformed `NEXT_PUBLIC_APP_URL`
 * from `getAppOrigin`) redirects back to /profile with an error code rather
 * than surfacing an unhandled exception.
 */
export async function startCheckout(): Promise<ActionResult<{ checkoutUrl: string }>> {
  const insforge = await createInsforgeServer();
  const { data, error: authError } = await insforge.auth.getCurrentUser();

  if (authError || !data.user) {
    redirect("/login?error=session");
  }

  // TEMPORARY: Checkout allowlist via the access table. Remove once live Stripe
  // is active and the real checkout flow becomes the gate.
  // See lib/access-rules.ts isUserApproved for details.
  const approved = await isUserApproved(data.user.id);
  if (!approved) {
    redirect("/profile?error=not_approved");
  }

  const subscriptionResult = await getSubscription(data.user.id);

  if (!subscriptionResult.ok) {
    console.error(
      "[actions/billing:startCheckout] could not read subscription",
    );
    redirect("/profile?error=checkout");
  }

  if (subscriptionResult.subscription.plan === "pro") {
    redirect("/profile?error=already_pro");
  }

  const proMonthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
  if (!proMonthlyPriceId) {
    console.error(
      "[actions/billing:startCheckout] missing STRIPE_PRO_MONTHLY_PRICE_ID",
    );
    redirect("/profile?error=checkout");
  }

  let checkoutUrl: string | undefined;

  try {
    const origin = getAppOrigin({
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      nodeEnv: process.env.NODE_ENV,
    });

    const { data: checkout, error: checkoutError } =
      await insforge.payments.stripe.createCheckoutSession("test", {
        mode: "subscription",
        lineItems: [{ priceId: proMonthlyPriceId, quantity: 1 }],
        successUrl: `${origin}/dashboard?upgraded=1`,
        cancelUrl: `${origin}/profile`,
        subject: { type: "user", id: data.user.id },
        customerEmail: data.user.email ?? undefined,
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

  return { success: true, checkoutUrl };
}
