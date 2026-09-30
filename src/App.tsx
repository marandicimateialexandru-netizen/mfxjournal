import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TitleBar } from "@/components/layout/TitleBar";
import { useAppBootstrap } from "@/db/useBootstrap";
import { Logo } from "@/components/shared/Logo";
import { AddTradeModal } from "@/features/trades/AddTradeModal";
import { AiTaskAssistant } from "@/features/ai/AiTaskAssistant";
import { TourOverlay } from "@/features/tour/TourOverlay";
import { IntroSplash } from "@/features/auth/IntroSplash";
import { ProfileGate } from "@/features/auth/ProfileGate";
import { CosmicTransition, CONVERGE_MS } from "@/features/auth/CosmicTransition";
import { BookIntro } from "@/features/auth/BookIntro";
import { AuthBackdrop, BACKDROP_REVEAL_MS, type BackdropMode } from "@/features/auth/AuthBackdrop";
import { useAuthStore } from "@/store/authStore";
import { useTourStore } from "@/store/tourStore";

import DashboardPage from "@/app/dashboard/DashboardPage";
import JournalPage from "@/app/journal/JournalPage";
import PlanningPage from "@/app/planning/PlanningPage";
import AdvisorPage from "@/app/advisor/AdvisorPage";
import ReportPage from "@/app/report/ReportPage";
import VariablesPage from "@/app/variables/VariablesPage";
import StrategyPage from "@/app/strategy/StrategyPage";
import SettingsPage from "@/app/settings/SettingsPage";

function SplashScreen() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-4 bg-[var(--color-background)]">
      <Logo size={40} />
      <p className="text-sm text-[var(--color-text-muted)]">
        Know your stake, reduce the mistake, increase your winrate.
      </p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-3 bg-[var(--color-background)] px-8 text-center">
      <Logo size={36} />
      <p className="text-sm text-[var(--color-danger)]">Failed to start: {message}</p>
    </div>
  );
}

/** The boot sequence: an intro (logo builds itself), a local profile login, a "black hole then Big
 *  Bang" transition, a personalized book cover you click to open, then the real app — see
 *  `features/auth/*` for each piece. `cosmic`, `book`, and `app` all render the real app tree
 *  underneath (bootstrap starts the moment login succeeds, at the top of `cosmic`), so by the time the
 *  book's curtain lifts, the dashboard's own entrance animations are already mid-flight instead of
 *  only starting after this whole sequence unmounts.
 *
 *  The decorative icon field (`AuthBackdrop`) is mounted exactly ONCE here, persisting across every
 *  phase below — it used to be re-instantiated fresh inside each of `IntroSplash`/`ProfileGate`/
 *  `CosmicTransition`/`BookIntro`, which meant every phase change silently reshuffled every icon to a
 *  brand new random layout, reading as a jarring hard reset instead of a continuous background. Its
 *  `backdropMode` state here (walk → converging → revealing → walk) is what drives that single
 *  instance through the whole sequence; see the state's own comment below for why the timers live here
 *  rather than in `CosmicTransition` itself. */
type Phase = "intro" | "auth" | "cosmic" | "book" | "app";

export default function App() {
  const [phase, setPhase] = useState<Phase>("intro");
  // Deliberately separate from `phase`: the dashboard (StatTile count-ups, the equity curve draw-in,
  // the app score meter) must not MOUNT until the trader actually clicks the book open, whenever
  // that happens to be — not the instant the cosmic sequence starts. Those animations play once on
  // mount and finish in ~1.3-1.9s; mounting them back at login meant they'd already run to
  // completion, hidden behind the book, by the time anyone clicked it, so the reveal showed static
  // final numbers instead of an animation. Gating the actual mount on the click means they start
  // fresh exactly when there's something to watch them finish revealing.
  const [contentMounted, setContentMounted] = useState(false);
  // The decorative icon field's mode. Deliberately owned HERE, not by `CosmicTransition`/`BookIntro`
  // themselves, because `AuthBackdrop` is now a single instance mounted once below (see its own
  // top-level doc comment) that persists across the whole intro→auth→cosmic→book sequence — the exact
  // fix for icons hard-resetting to a brand new random layout at every phase change. Timed against
  // `CosmicTransition`'s own exported `CONVERGE_MS` so the icons pulling in/flashing/repopulating stay
  // in lockstep with what's on screen, without `CosmicTransition` needing to own the backdrop directly
  // (it unmounts partway through the "revealing" window, so a timer living there would get cancelled
  // before finishing — this timer lives in the parent, which outlives it).
  const [backdropMode, setBackdropMode] = useState<BackdropMode>("walk");
  const login = useAuthStore((s) => s.login);
  const profileId = useAuthStore((s) => s.currentProfileId);
  const profileName = useAuthStore((s) => s.currentProfileName);
  const hasCompletedTutorial = useAuthStore((s) => s.hasCompletedTutorial);
  const startTour = useTourStore((s) => s.start);
  const { isReady, error } = useAppBootstrap(profileId);

  function handleAuthSuccess(id: string, name: string, tutorialAlreadySeen: boolean) {
    login(id, name, tutorialAlreadySeen);
    setPhase("cosmic");
  }

  // Auto-launch the onboarding tour the first time this profile ever reaches the dashboard — never
  // again after that (see `authStore`'s `hasCompletedTutorial`, carried from the `profiles` row at
  // login). Delayed so it doesn't collide with the dashboard's own one-shot entrance animations
  // (StatTile count-ups, the equity curve draw-in — see `contentMounted`'s own comment above), which
  // take up to ~1.9s to finish; starting the tour mid-count would be visually chaotic, spotlighting
  // numbers that are still animating. `tourAutoStarted` guards against re-firing if this effect's
  // deps happen to change again later in the same session (e.g. once the tour itself flips
  // `hasCompletedTutorial` back to true on finish).
  const tourAutoStarted = useRef(false);
  useEffect(() => {
    if (!contentMounted || !isReady || error || hasCompletedTutorial || tourAutoStarted.current) return;
    tourAutoStarted.current = true;
    const t = setTimeout(startTour, 2000);
    return () => clearTimeout(t);
  }, [contentMounted, isReady, error, hasCompletedTutorial, startTour]);

  useEffect(() => {
    if (phase !== "cosmic") {
      if (phase === "intro" || phase === "auth") setBackdropMode("walk");
      return;
    }
    setBackdropMode("converging");
    // The flash (`.animate-cosmic-flash` in `index.css`) starts as a small, fully transparent circle
    // and only reaches full opacity AND a scale large enough to cover the whole screen (not just its
    // own center) around 24% of its own duration in. Icons with a near-zero random stagger already
    // start fading back in the instant "revealing" begins — starting that right as the flash itself
    // begins meant some of them became visible around the screen's edges/corners while the flash was
    // still a small, soft blob in the middle, reading as a flicker during the explosion rather than a
    // clean "flash, then icons return underneath it." Waiting until the flash has actually grown to
    // cover the screen avoids that (this must scale down if `FLASH_MS` ever shrinks further).
    const REVEAL_START_DELAY_MS = 450;
    const t1 = setTimeout(() => setBackdropMode("revealing"), CONVERGE_MS + REVEAL_START_DELAY_MS);
    const t2 = setTimeout(() => setBackdropMode("walk"), CONVERGE_MS + REVEAL_START_DELAY_MS + BACKDROP_REVEAL_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  // A "Log Out" from the account menu (Sidebar) clears the auth store — react to that by dropping
  // straight back to the login screen instead of leaving a stale, unusable dashboard on screen.
  useEffect(() => {
    if (!profileId && phase === "app") {
      setPhase("auth");
      setContentMounted(false);
      setBackdropMode("walk");
      // Reset so a DIFFERENT profile logging in next (same app launch, no restart) still gets
      // correctly evaluated for its own first-time tour — this ref otherwise persists across
      // logout/login cycles within one App instance, which would wrongly skip it for profile B just
      // because profile A already finished the tour earlier in the same session.
      tourAutoStarted.current = false;
      useTourStore.getState().close();
    }
  }, [profileId, phase]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--color-background)] text-[var(--color-text)]">
      <TitleBar dark={phase !== "app"} />
      <div className="relative flex flex-1 overflow-hidden">
        {/* The persistent ambience behind the entire boot/login/book sequence — mounted ONCE here (not
            inside each phase screen) specifically so the icon field never hard-resets to a brand new
            random layout at a phase change; see `AuthBackdrop.tsx`'s top-level doc comment. This is
            `position: absolute`, and CSS always paints positioned elements above STATIC in-flow ones
            in the same stacking context regardless of DOM order — so every other sibling that needs to
            sit above it must itself be positioned (`relative`/`absolute`/`fixed`). IntroSplash/
            ProfileGate already are; the dashboard block below needs `relative` for the same reason —
            without it, the ambience painted OVER the dashboard once `contentMounted` flipped true,
            showing the icon field through the freshly-opened app until `phase` finally became `"app"`
            and this whole thing unmounted. */}
        {phase !== "app" && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#05050a]">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, rgba(124,29,63,0.22), transparent 55%), radial-gradient(circle at 50% 70%, rgba(76,29,149,0.22), transparent 60%)",
              }}
            />
            <AuthBackdrop mode={backdropMode} />
          </div>
        )}

        {phase === "intro" && <IntroSplash onDone={() => setPhase("auth")} />}
        {phase === "auth" && <ProfileGate onSuccess={handleAuthSuccess} />}

        {contentMounted &&
          (error ? (
            <ErrorScreen message={error} />
          ) : !isReady ? (
            <SplashScreen />
          ) : (
            <div className="relative flex flex-1 overflow-hidden bg-[var(--color-background)]">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/journal" element={<JournalPage />} />
                  <Route path="/planning" element={<PlanningPage />} />
                  <Route path="/advisor" element={<AdvisorPage />} />
                  <Route path="/report" element={<ReportPage />} />
                  <Route path="/variables" element={<VariablesPage />} />
                  <Route path="/strategy" element={<StrategyPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
              <AddTradeModal />
              <AiTaskAssistant />
              <TourOverlay />
            </div>
          ))}

        {phase === "cosmic" && <CosmicTransition onDone={() => setPhase("book")} />}
        {phase === "book" && <BookIntro name={profileName ?? "Trader"} onOpen={() => setContentMounted(true)} onDone={() => setPhase("app")} />}
      </div>
    </div>
  );
}
