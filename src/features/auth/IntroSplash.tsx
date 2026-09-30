import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/shared/Logo";

const INTRO_DURATION_MS = 2200;

/** The boot-time intro — the logo builds itself piece by piece (see `LogoMark`'s `animated` prop)
 *  against the same dark, dramatic palette as the login screen, then hands off after a fixed
 *  duration regardless of how fast the DB actually finished loading underneath (profile fetching is
 *  kicked off in parallel by the caller), so the intro always plays out in full instead of getting
 *  cut short on a fast machine. Renders no background of its own — it sits on top of the persistent
 *  shared ambience (`bg` + gradient + `AuthBackdrop`) mounted once in `App.tsx`. */
export function IntroSplash({ onDone }: { onDone: () => void }) {
  // See `CosmicTransition.tsx` for why this is a ref rather than a `[onDone]` dependency: `App.tsx`
  // passes a fresh inline function on every one of its own re-renders, which would otherwise reset
  // this timer back to the full duration each time instead of counting down once from mount.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(), INTRO_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden">
      <div className="relative">
        <LogoMark size={120} animated />
      </div>
      <p
        className="animate-logo-piece-in relative text-xs font-semibold uppercase tracking-[0.4em] text-[#a78bfa] opacity-0"
        style={{ animationDelay: "1050ms", animationFillMode: "forwards" }}
      >
        MFX Journal
      </p>
    </div>
  );
}
