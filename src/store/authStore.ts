import { create } from "zustand";

interface AuthState {
  currentProfileId: string | null;
  currentProfileName: string | null;
  /** Whether THIS profile has ever finished (or skipped) the onboarding tour — carried through from
   *  the `Profile` row at login time so `App.tsx` can decide whether to auto-launch it without a
   *  separate DB round-trip. Stays `true` for the rest of the session once the tour finishes, even
   *  though the DB write happens async — see `useTourStore`. */
  hasCompletedTutorial: boolean;
  login: (id: string, name: string, hasCompletedTutorial: boolean) => void;
  logout: () => void;
  markTutorialSeen: () => void;
}

/** Deliberately NOT persisted to localStorage — every app launch shows the profile picker again,
 *  matching the "welcome" login experience this was built for, rather than silently staying signed
 *  in as whoever last used the app. */
export const useAuthStore = create<AuthState>((set) => ({
  currentProfileId: null,
  currentProfileName: null,
  hasCompletedTutorial: true,
  login: (id, name, hasCompletedTutorial) => set({ currentProfileId: id, currentProfileName: name, hasCompletedTutorial }),
  logout: () => set({ currentProfileId: null, currentProfileName: null, hasCompletedTutorial: true }),
  markTutorialSeen: () => set({ hasCompletedTutorial: true }),
}));
