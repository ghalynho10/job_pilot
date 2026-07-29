const listeners = new Set<() => void>();

function notifyStagedResumeChanged(): void {
  for (const listener of listeners) listener();
}

export function subscribeToStagedResume(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function storageKey(userId: string): string {
  return `profile-staged-resume:${userId}`;
}

function readRaw(userId: string): { key?: unknown; fileName?: unknown } | null {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as { key?: unknown; fileName?: unknown }) : null;
  } catch {
    return null;
  }
}

export function getStagedResumeKey(userId: string): string | null {
  const parsed = readRaw(userId);
  return typeof parsed?.key === "string" ? parsed.key : null;
}

export function getStagedResumeFileName(userId: string): string | null {
  const parsed = readRaw(userId);
  return typeof parsed?.fileName === "string" ? parsed.fileName : null;
}

export function getStagedResumeServerSnapshot(): null {
  return null;
}

export function writeStagedResume(userId: string, key: string, fileName: string): void {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify({ key, fileName }));
  } catch {
    // sessionStorage unavailable (private browsing, quota exceeded): the staged
    // resume simply won't survive a refresh, same as before this feature existed
  }
  notifyStagedResumeChanged();
}

export function clearStagedResume(userId: string): void {
  try {
    sessionStorage.removeItem(storageKey(userId));
  } catch {
    // nothing to clean up if sessionStorage itself is unavailable
  }
  notifyStagedResumeChanged();
}
