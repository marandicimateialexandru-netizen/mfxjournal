import { useEffect, useRef, useState } from "react";

// Exported so `App.tsx` can drive the shared, persistent `AuthBackdrop` instance's `mode` on the same
// schedule as this component's own visuals (blackout/flash) — the backdrop itself is no longer
// rendered here (see `AuthBackdrop.tsx`'s top-level doc comment for why: it now lives once at the top
// of `App.tsx` and persists across the whole intro→auth→cosmic→book sequence instead of getting
// re-mounted, and re-randomized, fresh inside every phase).
//
// Must match `AuthBackdrop.tsx`'s `CONVERGE_MAX_DELAY_MS + CONVERGE_DURATION_MAX_MS` — every element
// there gets its own random delay AND its own random duration, so this has to cover the slowest,
// furthest-out possible combination, not just a fixed per-element animation length. Otherwise this
// fires (and the blackout/flash cut in) before the slowest element has actually finished arriving.
export const CONVERGE_MS = 2350;
export const FLASH_MS = 1700;

/** The "gravitational pull then Big Bang" beat between the login card swiping away and the book
 *  appearing. Renders no background of its own — it sits directly on top of the persistent shared
 *  ambience (`bg` + gradient + `AuthBackdrop`) mounted once in `App.tsx`, which is what's actually
 *  showing the icons drift toward the center; this component only adds the blackout iris and the flash
 *  on top of that. `App.tsx` drives the shared `AuthBackdrop`'s mode (`"converging"` then
 *  `"revealing"`) on the exact same `CONVERGE_MS`/`FLASH_MS` schedule used below, so the icons pulling
 *  in and the screen dimming/flashing all stay in lockstep despite living in different components now.
 *  The whole screen dims in step with the pull (`.animate-converge-blackout`, a closing iris) but
 *  deliberately never goes to a flat, total black — just dim enough to read as "everything's getting
 *  swallowed," not a hard cut to a void. Once every glyph has arrived, a long, layered flash (a tight
 *  bright core plus a slower violet-white halo) expands and fades gradually — no crack/shatter effect
 *  in between; straight from the gathering into the "poof." `onDone` fires as the flash finishes,
 *  handing off to `BookIntro`, which starts its own slow, graceful materialize entrance while the
 *  shared backdrop is still repopulating underneath (`"revealing"` mode) — the two happen concurrently
 *  rather than the book waiting for the background to finish first. */
export function CosmicTransition({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<"converge" | "flash">("converge");
  // `App.tsx` passes `onDone` as a fresh inline arrow function on every one of its own re-renders (and
  // it re-renders several times while this is mounted, since `backdropMode` changes underneath it) —
  // if this effect depended on `[onDone]` directly, React would see a "new" callback each time, tear
  // down the pending timers, and reschedule both of them from that later moment, silently pushing the
  // real wait far past `CONVERGE_MS + FLASH_MS` (this was the actual cause of the book taking several
  // seconds longer than intended to appear — the flash's own CSS animation played on schedule
  // regardless, since it doesn't care about this bug, which is what made the extra wait look like a
  // silent "just background" gap after an on-time explosion). A ref lets the effect read whatever
  // `onDone` is CURRENT at fire time without needing it in the dependency array, so this runs exactly
  // once, on mount, no matter how many times the parent re-renders in the meantime.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => setStage("flash"), CONVERGE_MS);
    const t2 = setTimeout(() => onDoneRef.current(), CONVERGE_MS + FLASH_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-50 overflow-hidden">
      {stage === "converge" && <div className="animate-converge-blackout pointer-events-none absolute inset-0" />}
      {stage === "flash" && (
        <>
          <div
            className="animate-cosmic-flash pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle, #ffffff, #e9d5ff 35%, #7c3aed 55%, transparent 72%)" }}
          />
          <div
            className="animate-cosmic-flash-core pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle, #ffffff, transparent 45%)" }}
          />
        </>
      )}
    </div>
  );
}
