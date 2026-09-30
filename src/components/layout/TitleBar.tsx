import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const appWindow = getCurrentWindow();

/** The app's own title bar, replacing the OS-native one (`decorations: false` in `tauri.conf.json`) —
 *  this is what makes the app read as "a real app" with its own minimize/maximize/close instead of
 *  sitting inside a plain OS window frame. Rendered at the very top of `App.tsx` unconditionally
 *  (splash, login, error, and the main app all mount it), since with decorations off there is
 *  otherwise no way to drag or close the window at all during any of those states.
 *
 *  Deliberately just an empty drag strip plus the three window controls — no logo/wordmark here
 *  anymore, since the Sidebar already shows the app's branding right below it and having both
 *  stacked on top of each other read as redundant.
 *
 *  `dark` forces a fixed near-black look regardless of the user's chosen app theme — used during the
 *  intro/login/transition phases, which are the app's own brand moment and shouldn't shift with
 *  whatever color preset the trader has picked for their actual workspace.
 *
 *  Real OS-level fullscreen (`appWindow.setFullscreen`, not just maximize) — no taskbar, no window
 *  chrome, the app fully covering the screen. F11 toggles it where that key behaves normally, but
 *  it's deliberately NOT the only way in: plenty of laptop keyboards remap the bare F-keys to
 *  media/system functions (confirmed on at least one machine where Fn+F11 puts the laptop to sleep
 *  instead), so the button is the real, reliable control — F11 and Escape are bonuses on top of it.
 *  The button itself is a genuine toggle (same icon-swap pattern as the maximize/restore button
 *  right next to it) — click to go fullscreen, click the SAME button again to leave, rather than a
 *  one-way action that only Escape or F11 could undo. That means it has to stay reachable while
 *  fullscreen: the rest of the bar (drag region, minimize/maximize/close — none of which make sense
 *  mid-fullscreen anyway) hides itself, but this one control survives as a small floating button in
 *  the corner instead of vanishing with everything else. */
export function TitleBar({ dark = false }: { dark?: boolean }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function toggleFullscreen() {
    try {
      const goingFullscreen = !(await appWindow.isFullscreen());
      // A known upstream bug (tauri-apps/tao#1353): on Windows, an undecorated window that's
      // MAXIMIZED when it enters fullscreen gets clamped to the desktop's "work area" (screen minus
      // taskbar) instead of the real monitor bounds — leaving an empty strip exactly the height of
      // the taskbar, showing the OS desktop through it instead of the app. Un-maximizing first keeps
      // the transition on the "normal window -> fullscreen" path instead, which measures correctly.
      if (goingFullscreen && (await appWindow.isMaximized())) {
        await appWindow.unmaximize();
        // Let Windows actually finish the restore animation/resize before requesting fullscreen —
        // firing both in the same tick is what triggers the buggy clamped-to-work-area code path.
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      await appWindow.setFullscreen(goingFullscreen);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.isMaximized().then(setIsMaximized);
    appWindow.isFullscreen().then(setIsFullscreen);
    appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
      appWindow.isFullscreen().then(setIsFullscreen);
    }).then((f) => {
      unlisten = f;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape") {
        // Exit-only, never toggles fullscreen ON — Escape already means "back/cancel" everywhere
        // else in this app, and entering fullscreen should stay a deliberate action.
        appWindow
          .isFullscreen()
          .then((v) => {
            if (v) void appWindow.setFullscreen(false);
          })
          .catch(console.error);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const mutedText = dark ? "text-[#9891ab]" : "text-[var(--color-text-muted)]";

  if (isFullscreen) {
    return (
      <button
        onClick={toggleFullscreen}
        aria-label="Exit fullscreen"
        title="Exit fullscreen"
        className={cn(
          "group fixed right-2 top-2 z-[300] flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-surface)] opacity-30 transition-all duration-150 hover:opacity-100 hover:scale-110 active:scale-90",
          mutedText,
        )}
      >
        <Minimize2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex h-9 shrink-0 select-none items-center justify-end border-b",
        dark ? "border-[#1a1a24] bg-[#08080d]" : "border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      <div className="flex h-full items-stretch pr-1.5">
        <button
          onClick={toggleFullscreen}
          className="group flex h-full w-11 items-center justify-center"
          aria-label="Enter fullscreen"
          title="Fullscreen"
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150 group-hover:scale-110 group-active:scale-90",
              mutedText,
              dark ? "group-hover:bg-white/10 group-hover:text-white" : "group-hover:bg-black/5 group-hover:text-[var(--color-text)]",
            )}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </button>
        <button onClick={() => appWindow.minimize()} className="group flex h-full w-11 items-center justify-center" aria-label="Minimize">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150 group-hover:scale-110 group-active:scale-90",
              mutedText,
              dark ? "group-hover:bg-white/10 group-hover:text-white" : "group-hover:bg-black/5 group-hover:text-[var(--color-text)]",
            )}
          >
            <Minus className="h-3.5 w-3.5" />
          </span>
        </button>
        <button onClick={() => appWindow.toggleMaximize()} className="group flex h-full w-11 items-center justify-center" aria-label={isMaximized ? "Restore" : "Maximize"}>
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150 group-hover:scale-110 group-active:scale-90",
              mutedText,
              dark ? "group-hover:bg-white/10 group-hover:text-white" : "group-hover:bg-black/5 group-hover:text-[var(--color-text)]",
            )}
          >
            {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          </span>
        </button>
        <button onClick={() => appWindow.close()} className="group flex h-full w-11 items-center justify-center" aria-label="Close">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150 group-hover:scale-110 group-hover:bg-[var(--color-danger)] group-hover:text-white group-hover:shadow-[0_0_12px_-2px_var(--color-danger)] group-active:scale-90",
              mutedText,
            )}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
}
