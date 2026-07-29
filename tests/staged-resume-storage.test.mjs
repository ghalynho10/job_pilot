import assert from "node:assert/strict";
import test from "node:test";

import {
  clearStagedResume,
  getStagedResumeFileName,
  getStagedResumeKey,
  getStagedResumeServerSnapshot,
  subscribeToStagedResume,
  writeStagedResume,
} from "../lib/staged-resume-storage.ts";

function installMemoryStorage() {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  return store;
}

function installThrowingStorage() {
  globalThis.sessionStorage = {
    getItem: () => {
      throw new Error("sessionStorage unavailable");
    },
    setItem: () => {
      throw new Error("sessionStorage unavailable");
    },
    removeItem: () => {
      throw new Error("sessionStorage unavailable");
    },
  };
}

test.afterEach(() => {
  delete globalThis.sessionStorage;
});

test("writeStagedResume then reading back returns the same key and file name", () => {
  installMemoryStorage();

  writeStagedResume("user-1", "user-1/abc123.pdf", "resume.pdf");

  assert.equal(getStagedResumeKey("user-1"), "user-1/abc123.pdf");
  assert.equal(getStagedResumeFileName("user-1"), "resume.pdf");
});

test("different users never read each other's staged resume (namespaced by user id)", () => {
  installMemoryStorage();

  writeStagedResume("user-1", "user-1/abc123.pdf", "resume.pdf");

  assert.equal(getStagedResumeKey("user-2"), null);
  assert.equal(getStagedResumeFileName("user-2"), null);
});

test("clearStagedResume removes the entry, later reads return null", () => {
  installMemoryStorage();

  writeStagedResume("user-1", "user-1/abc123.pdf", "resume.pdf");
  clearStagedResume("user-1");

  assert.equal(getStagedResumeKey("user-1"), null);
  assert.equal(getStagedResumeFileName("user-1"), null);
});

test("reading a user who never staged anything returns null, not an error", () => {
  installMemoryStorage();

  assert.equal(getStagedResumeKey("never-staged"), null);
  assert.equal(getStagedResumeFileName("never-staged"), null);
});

test("malformed JSON already in storage is treated as nothing staged, not a thrown error", () => {
  const store = installMemoryStorage();
  store.set("profile-staged-resume:user-1", "{not valid json");

  assert.equal(getStagedResumeKey("user-1"), null);
  assert.equal(getStagedResumeFileName("user-1"), null);
});

test("a stored value missing key or fileName is treated as nothing staged", () => {
  const store = installMemoryStorage();
  store.set("profile-staged-resume:user-1", JSON.stringify({ key: "only-a-key" }));

  assert.equal(getStagedResumeKey("user-1"), "only-a-key");
  assert.equal(getStagedResumeFileName("user-1"), null);
});

test("an unavailable sessionStorage (private browsing, quota exceeded) degrades to nothing staged, never throws", () => {
  installThrowingStorage();

  assert.doesNotThrow(() => writeStagedResume("user-1", "user-1/abc123.pdf", "resume.pdf"));
  assert.doesNotThrow(() => clearStagedResume("user-1"));
  assert.equal(getStagedResumeKey("user-1"), null);
  assert.equal(getStagedResumeFileName("user-1"), null);
});

test("getStagedResumeServerSnapshot always returns null, matching the server render with no sessionStorage", () => {
  assert.equal(getStagedResumeServerSnapshot(), null);
});

test("subscribeToStagedResume notifies listeners on both write and clear, and unsubscribe stops further notifications", () => {
  installMemoryStorage();

  let callCount = 0;
  const unsubscribe = subscribeToStagedResume(() => {
    callCount += 1;
  });

  writeStagedResume("user-1", "user-1/abc123.pdf", "resume.pdf");
  assert.equal(callCount, 1);

  clearStagedResume("user-1");
  assert.equal(callCount, 2);

  unsubscribe();
  writeStagedResume("user-1", "user-1/def456.pdf", "resume2.pdf");
  assert.equal(callCount, 2, "no further notifications after unsubscribing");
});
