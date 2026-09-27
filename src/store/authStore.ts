import { create } from "zustand";

interface AuthState {
  currentProfileId: string | null;
  currentProfileName: string | null;
  login: (id: string, name: string) => void;
  logout: () => void;
}

/** Deliberately NOT persisted to localStorage — every app launch shows the profile picker again,
 *  matching the "welcome" login experience this was built for, rather than silently staying signed
 *  in as whoever last used the app. */
export const useAuthStore = create<AuthState>((set) => ({
  currentProfileId: null,
  currentProfileName: null,
  login: (id, name) => set({ currentProfileId: id, currentProfileName: name }),
  logout: () => set({ currentProfileId: null, currentProfileName: null }),
}));
