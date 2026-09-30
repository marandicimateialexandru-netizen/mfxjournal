import { create } from "zustand";

interface TourState {
  active: boolean;
  stepIndex: number;
  start: () => void;
  next: () => void;
  back: () => void;
  close: () => void;
  goTo: (stepIndex: number) => void;
}

/** Drives the onboarding tour (`TourOverlay.tsx`) — which step is showing and whether it's running at
 *  all. Deliberately just index/active state, no persistence: "has this profile ever seen the tour"
 *  lives in the DB (`profiles.has_completed_tutorial`, via `authStore.hasCompletedTutorial`), not
 *  here — this store only cares about the CURRENT run, whether auto-launched on first login or
 *  replayed from Settings. */
export const useTourStore = create<TourState>((set) => ({
  active: false,
  stepIndex: 0,
  start: () => set({ active: true, stepIndex: 0 }),
  next: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),
  back: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  close: () => set({ active: false, stepIndex: 0 }),
  goTo: (stepIndex) => set({ stepIndex }),
}));
