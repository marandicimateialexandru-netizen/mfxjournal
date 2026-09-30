import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { LogoMark } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

const MATERIALIZE_MS = 850;
const LIFT_START_MS = 320;
const LIFT_MS = 650;

/** The personalized "book" moment between a successful login and the dashboard. It mounts already
 *  mid-explosion — the cover "materializes" out of the Big Bang flash `CosmicTransition` just played
 *  (a slow, graceful heavenly descent from above with no bounce, not a plain fade or a punchy pop). A
 *  tall, proper-journal-proportioned cover with a small ribbon/bookmark tail at the bottom, etched with
 *  faint chart motifs and the trader's own name, sits waiting (a breathing glow layered BEHIND it, not
 *  animated on the card itself — see the note below) until clicked. Clicking pops the cover once for
 *  tactile feedback, then the whole panel swipes up off-screen like a rising curtain — a "digital rain"
 *  decrypt effect plays along the BOTTOM of the background as it lifts (not on the book/journal itself,
 *  which stays clean) — revealing the dashboard underneath.
 *
 *  While `stage === "cover"`, this renders NO background of its own — it's transparent, so the
 *  persistent shared ambience mounted once in `App.tsx` (which is what's actually driving the icon
 *  field, now mid-`"revealing"`) shows straight through behind the book, instead of this component
 *  spinning up its own fresh, differently-randomized copy the way it used to (the exact "brand new
 *  thing" reset that used to make this handoff feel like a glitch rather than a continuation). Once
 *  clicked, it switches to its OWN opaque background for the `"clicked"`/`"lifting"` stages specifically
 *  — needed because the dashboard mounts (opaque, behind this) the instant it's clicked (see `onOpen` /
 *  `App.tsx`'s `contentMounted`), and this panel has to keep fully hiding it until the curtain visually
 *  lifts away, not let it show through immediately on click.
 *
 *  Rendered as a fixed, full-screen `absolute inset-0` overlay ON TOP of the already-mounted dashboard
 *  (see `App.tsx`) — NOT as a flex sibling, which was the earlier "half the screen is the book, half
 *  is the dashboard" bug. Because the dashboard only mounts the instant this is clicked, its entrance
 *  animations start fresh right as the curtain begins lifting instead of having already finished
 *  off-screen. Once its one-shot materialize entrance finishes, the cover switches to a continuous
 *  gentle float/bob — an invitation to click it, not a static card. */
export function BookIntro({ name, onOpen, onDone }: { name: string; onOpen: () => void; onDone: () => void }) {
  const [stage, setStage] = useState<"cover" | "clicked" | "lifting">("cover");
  const [materialized, setMaterialized] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMaterialized(true), MATERIALIZE_MS);
    return () => clearTimeout(t);
  }, []);

  function handleOpen() {
    onOpen();
    setStage("clicked");
    setTimeout(() => setStage("lifting"), LIFT_START_MS);
    setTimeout(onDone, LIFT_START_MS + LIFT_MS);
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden",
        stage !== "cover" && "bg-[#05050a]",
        stage === "lifting" && "animate-curtain-lift",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(124,29,63,0.22), transparent 58%), radial-gradient(circle at 50% 62%, rgba(76,29,149,0.22), transparent 65%)",
        }}
      />

      <div className="relative flex h-[460px] w-64 items-center justify-center">
        {/* The breathing glow lives on its OWN layer behind the card, its OPACITY animating rather
            than the card's `box-shadow` — animating box-shadow forces a full repaint of the card
            every frame (not a compositor-only property like opacity/transform), which is exactly
            what read as "laggy, not smooth." */}
        {stage === "cover" && (
          <div
            className="animate-book-glow-breathe pointer-events-none absolute inset-0 -z-10 rounded-[2rem]"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.65), rgba(139,92,246,0.15) 55%, transparent 75%)" }}
          />
        )}

        <button
          onClick={handleOpen}
          disabled={stage !== "cover"}
          className={cn(
            "group relative flex h-[460px] w-64 flex-col items-center overflow-visible rounded-2xl border border-[#3a2550] bg-gradient-to-br from-[#1a0f2e] via-[#170a24] to-[#2c0f1f] px-7 py-9 text-center transition-[filter]",
            stage === "cover" && "hover:brightness-110",
            stage === "clicked" && "animate-book-click-pop",
            !materialized ? "animate-book-materialize" : stage === "cover" && "animate-book-float",
          )}
        >
          {/* Bookmark ribbon tail hanging off the bottom edge */}
          <div
            className="absolute -bottom-6 left-1/2 h-8 w-10 -translate-x-1/2 bg-gradient-to-b from-[#9f1239] to-[#7c1d3f]"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)" }}
          />

          <div className="relative flex h-full w-full flex-col items-center overflow-hidden rounded-xl">
            {/* Faint etched chart motifs framing the cover */}
            <svg className="pointer-events-none absolute left-1/2 top-8 h-10 w-44 -translate-x-1/2 opacity-25" viewBox="0 0 192 40" fill="none">
              <polyline points="4,34 30,26 54,30 80,14 106,20 132,6 158,12 188,2" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <svg className="pointer-events-none absolute bottom-10 left-1/2 h-8 w-32 -translate-x-1/2 opacity-20" viewBox="0 0 128 32" fill="none">
              <line x1="16" y1="6" x2="16" y2="26" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" />
              <line x1="64" y1="2" x2="64" y2="30" stroke="#9f1239" strokeWidth="4" strokeLinecap="round" />
              <line x1="112" y1="10" x2="112" y2="22" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <svg className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 opacity-[0.07]" viewBox="0 0 96 96" fill="none">
              {Array.from({ length: 16 }).map((_, i) => (
                <rect key={i} x={(i % 4) * 24 + 2} y={Math.floor(i / 4) * 24 + 2} width="20" height="20" rx="4" stroke="#c4b5fd" strokeWidth="1.5" fill="none" />
              ))}
            </svg>

            <div className="relative flex flex-1 flex-col items-center justify-center gap-3">
              <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#a78bfa]/50 to-transparent" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#8b5cf6]">Welcome</span>
              <LogoMark size={48} />
              <h1 className="font-serif text-2xl font-bold leading-tight text-white">
                {name}'s
                <br />
                Journal
              </h1>
              <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[#a78bfa]/50 to-transparent" />
            </div>

            <span className="relative pb-1 flex items-center gap-1.5 text-xs text-[#9891ab] transition-colors group-hover:text-[#c4b5fd]">
              <Sparkles className="h-3.5 w-3.5" /> {stage === "cover" ? "Tap to open" : "Opening…"}
            </span>
          </div>
        </button>
      </div>

      {/* The "encrypt" digital-rain effect lives on the background, anchored to the bottom of the
          screen, only once the curtain starts lifting — riding along with this whole panel as it
          exits (it's a sibling inside the same lifting container) rather than cluttering the book's
          own cover. */}
      {stage === "lifting" && (
        <div
          className="animate-matrix-rain pointer-events-none absolute inset-x-0 bottom-0 h-48"
          style={{
            backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 3px, rgba(52,211,153,0.55) 4px, transparent 6px)",
            backgroundSize: "3px 24px",
            mixBlendMode: "screen",
            maskImage: "linear-gradient(to top, black, transparent)",
            WebkitMaskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
      )}
    </div>
  );
}
