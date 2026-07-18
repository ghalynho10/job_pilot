import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("starts both planned OAuth providers with server side PKCE", async () => {
  const source = await readProjectFile("actions/auth.ts");

  assert.match(source, /startOAuth\("google"\)/);
  assert.match(source, /startOAuth\("github"\)/);
  assert.match(source, /skipBrowserRedirect: true/);
  assert.match(source, /httpOnly: true/);
});

test("exchanges callback codes and clears the verifier on every exit", async () => {
  const source = await readProjectFile("app/(auth)/callback/route.ts");
  const verifierDeletes = source.match(
    /cookies\.delete\(OAUTH_VERIFIER_COOKIE\)/g,
  );

  assert.match(source, /exchangeOAuthCode\(code, verifier\)/);
  assert.match(source, /new URL\("\/dashboard", appOrigin\)/);
  assert.equal(verifierDeletes?.length, 4);
});

test("protects every planned private route family", async () => {
  const source = await readProjectFile("proxy.ts");

  assert.match(source, /"\/dashboard\/:path\*"/);
  assert.match(source, /"\/profile\/:path\*"/);
  assert.match(source, /"\/find-jobs\/:path\*"/);
});

test("preserves refreshed or cleared auth cookies on redirects", async () => {
  const source = await readProjectFile("proxy.ts");

  assert.match(source, /copyResponseCookies\(response, redirectResponse\)/);
  assert.match(source, /source\.cookies\.getAll\(\)/);
});

test("sign out clears the InsForge session and returns to login", async () => {
  const source = await readProjectFile("actions/auth.ts");

  assert.match(source, /await auth\.signOut\(\)/);
  assert.match(source, /redirect\(failed \? "\/login\?error=sign_out" : "\/login"\)/);
});

test("login exposes one visible page heading and both provider actions", async () => {
  const source = await readProjectFile("app/(auth)/login/page.tsx");

  assert.match(source, /<Navbar showAuthAction=\{false\} \/>/);
  assert.equal(source.match(/<h1/g)?.length, 1);
  assert.match(source, /<OAuthButton provider="Google" \/>/);
  assert.match(source, /<OAuthButton provider="GitHub" \/>/);
  assert.doesNotMatch(source, /href="\/(?:terms|privacy)"/);
});
