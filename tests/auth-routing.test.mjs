import assert from "node:assert/strict";
import test from "node:test";

import {
  createLoginUrl,
  getAppOrigin,
} from "../lib/auth-routing.ts";

test("uses the configured application origin for OAuth callbacks", () => {
  const origin = getAppOrigin({
    appUrl: "https://jobs.example.com/some/path",
    nodeEnv: "production",
  });

  assert.equal(origin, "https://jobs.example.com");
});

test("uses localhost only outside production when no application URL is set", () => {
  const origin = getAppOrigin({ nodeEnv: "development" });

  assert.equal(origin, "http://localhost:3000");
});

test("fails closed when the production application URL is missing", () => {
  assert.throws(
    () => getAppOrigin({ nodeEnv: "production" }),
    /NEXT_PUBLIC_APP_URL is required in production/,
  );
});

test("rejects application URLs that do not use http or https", () => {
  assert.throws(
    () =>
      getAppOrigin({
        appUrl: "javascript:alert(1)",
        nodeEnv: "production",
      }),
    /must use http or https/,
  );
});

test("does not show an expired session error to a first time visitor", () => {
  const loginUrl = createLoginUrl("https://jobs.example.com", false);

  assert.equal(loginUrl.toString(), "https://jobs.example.com/login");
});

test("shows an expired session error when session credentials were present", () => {
  const loginUrl = createLoginUrl("https://jobs.example.com", true);

  assert.equal(
    loginUrl.toString(),
    "https://jobs.example.com/login?error=session",
  );
});
