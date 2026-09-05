const KEY = "mfxjournal:activeWorkspaceId";

export function getPersistedWorkspaceId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setPersistedWorkspaceId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // ignore (private browsing / storage disabled)
  }
}
