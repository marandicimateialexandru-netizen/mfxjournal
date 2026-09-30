import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
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
 *  whatever color preset the trader has picked for their actual workspace. */
export function TitleBar({ dark = false }: { dark?: boolean }) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.isMaximized().then(setIsMaximized);
    appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    }).then((f) => {
      unlisten = f;
    });
    return () => unlisten?.();
  }, []);

  const mutedText = dark ? "text-[#9891ab]" : "text-[var(--color-text-muted)]";

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex h-9 shrink-0 select-none items-center justify-end border-b",
        dark ? "border-[#1a1a24] bg-[#08080d]" : "border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      <div className="flex h-full items-stretch pr-1.5">
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
