const KEY_PREFIX = "mfxjournal:activeWorkspaceId:";

/** Namespaced per profile — different people sharing this install must never inherit each other's
 *  last-active workspace. */
export function getPersistedWorkspaceId(profileId: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + profileId);
  } catch {
    return null;
  }
}

export function setPersistedWorkspaceId(profileId: string, id: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + profileId, id);
  } catch {
    // ignore (private browsing / storage disabled)
  }
}
