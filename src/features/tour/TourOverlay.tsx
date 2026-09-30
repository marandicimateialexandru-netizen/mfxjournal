import { useEffect, useLayoutEffect, useRef, useState, startTransition } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTourStore } from "@/store/tourStore";
import { useAuthStore } from "@/store/authStore";
import { markTutorialComplete } from "@/db/queries/profiles";
import { TOUR_STEPS } from "./tourSteps";

const CARD_WIDTH = 360;
const CARD_MARGIN = 16;
// A side-docked card that couldn't find comfortable room and got clamped to the viewport edge (see
// `computeCardPosition`'s `preferSide` branch) used the same 16px as every other margin in this file —
// which read as sitting flush against the edge, too tight against whatever real content was still
// visible nearby (the Journal's Variables column, the AI Assistant's own logo). A side-docked card
// specifically benefits from more breathing room than a below/above-docked one does, since it's
// sharing the same horizontal band as real content instead of sitting in a clear strip beneath it.
const SIDE_DOCK_EDGE_MARGIN = 130;
// A starting guess only, used for exactly one frame before the card's real height is measured (see
// `cardHeight` state below) — every positioning calculation uses that measured value from then on.
// This used to be a hardcoded final answer (290) with no measurement backing it, which was quietly
// wrong for every step whose body/example text ran longer than whatever step it was tuned against —
// confirmed via direct DOM measurement at 420px actual vs. 290px assumed on the Equity Curve step,
// which is what was pushing the card (Next button included) off the bottom of the viewport.
const CARD_HEIGHT_FALLBACK = 300;
const SPOTLIGHT_PADDING = 10;

/** Polls `find()` on every animation frame until it returns a truthy value, up to `maxAttempts`
 *  (~1s at 60fps) — used both to wait for a route change to actually mount its target element, and to
 *  wait for a `preClickSelector` target (e.g. a calendar day with trades) to exist before clicking it.
 *  `isCancelled` is a live check (not a snapshot) so an in-flight poll stops immediately if the step
 *  changes again before it resolves. */
async function pollFor<T>(find: () => T | null, isCancelled: () => boolean, maxAttempts = 60): Promise<T | null> {
  for (let i = 0; i < maxAttempts; i++) {
    if (isCancelled()) return null;
    const result = find();
    if (result) return result;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** True when a rect covers almost the entire viewport in both dimensions — a spotlight ring drawn
 *  around something that big just traces the screen's own edges, which reads as a broken/oversized
 *  glitch rather than an actual highlight, and (via `computeCardPosition`'s fallback) tends to dock
 *  the card at a screen edge where it can end up sitting over real page chrome (e.g. the sidebar).
 *  Most targets never get close to this; it mainly matters for a Dialog that renders near edge-to-edge
 *  because the window itself is narrower than the dialog's own max-width — in that case the dialog
 *  genuinely IS that big, so there's nothing to "measure correctly," just nothing worth ringing. */
function isRectTooLarge(rect: DOMRect): boolean {
  return rect.width >= window.innerWidth * 0.85 && rect.height >= window.innerHeight * 0.85;
}

interface Strip {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Four rectangles framing the spotlighted rect (top/bottom/left/right) instead of one full-screen
 *  overlay — needed specifically because `backdrop-filter: blur()` has no way to exclude a hole from
 *  itself the way a `box-shadow` spread can fake a cutout with a solid color. Each strip gets its OWN
 *  `backdrop-filter`, blurring only what's actually behind IT, so the area they leave uncovered (the
 *  target, plus padding) stays completely untouched — genuinely sharp, not blurred-then-revealed. The
 *  left/right strips only span the target's own vertical band (not the full height) so they don't
 *  overlap the top/bottom strips at the corners. */
function computeSpotlightStrips(rect: DOMRect, padding: number): Strip[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const holeTop = rect.top - padding;
  const holeLeft = rect.left - padding;
  const holeRight = rect.right + padding;
  const holeBottom = rect.bottom + padding;
  return [
    { top: 0, left: 0, width: vw, height: Math.max(0, holeTop) },
    { top: holeBottom, left: 0, width: vw, height: Math.max(0, vh - holeBottom) },
    { top: holeTop, left: 0, width: Math.max(0, holeLeft), height: Math.max(0, holeBottom - holeTop) },
    { top: holeTop, left: holeRight, width: Math.max(0, vw - holeRight), height: Math.max(0, holeBottom - holeTop) },
  ];
}

/** Picks where the card sits relative to the spotlighted rect — below it, or above it if there's no
 *  room below, full stop, UNLESS the step explicitly asks for a side dock via `preferSide` (see
 *  `TourStep.cardSide`). An earlier version tried right/left docking generically, for EVERY step, as
 *  a fallback after below/above — that was itself the source of two confirmed bugs (the card crowded
 *  into a screen corner, and the card partly rendering off-screen with its own Next button
 *  unreachable) for an edge-pinned target, where "there's technically N pixels of horizontal space" is
 *  a much weaker guarantee than "there's room below/above." Generic side-docking was removed for that
 *  reason. But a WIDE, roughly-centered target (a page-width Dialog) is the opposite case: below/above
 *  usually has no room either (the dialog fills most of the viewport height too), and the automatic
 *  centered fallback lands the card directly on the target's own main content — confirmed directly by
 *  visual testing on the week-detail modal, covering its trades table. `preferSide`, set per-step (not
 *  guessed generically), opts a specific step into trying that side first, and is intentionally
 *  willing to sit with a smaller-than-usual margin (down to a modest overlap with the target's own
 *  edge, clamped on-screen) rather than fall back to centered — for THESE specific steps, a small
 *  overlap at the target's edge beats covering its center. */
function computeCardPosition(
  rect: DOMRect | null,
  cardHeight: number,
  preferSide?: "left" | "right",
): { top: number; left: number } {
  if (!rect) {
    return {
      top: Math.round(window.innerHeight / 2 - cardHeight / 2),
      left: Math.round(window.innerWidth / 2 - CARD_WIDTH / 2),
    };
  }

  if (preferSide) {
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const order: Array<"left" | "right"> = preferSide === "right" ? ["right", "left"] : ["left", "right"];
    const comfortable = order.find((side) => (side === "right" ? spaceRight : spaceLeft) > CARD_WIDTH + CARD_MARGIN);
    // If neither side has comfortable room, trust the step's own explicit preference rather than
    // "whichever side has more raw pixels" — a target that spans nearly the full viewport width (a
    // wide table, a wide grid) can have close to ZERO space on either side of its own bounding box
    // even though there's real blank space *inside* it (past the last populated column, say); a
    // pixel-comparison tie-break picked the wrong side here in exactly that case, landing the card on
    // the side with a few more pixels of nothing rather than the side the step actually asked for.
    // Docking flush against the preferred edge and letting the clamp below pull it fully on-screen
    // lands the card right at that blank area instead.
    const side = comfortable ?? preferSide;
    const margin = comfortable ? CARD_MARGIN : 8;
    const left = side === "right" ? rect.right + margin : rect.left - CARD_WIDTH - margin;
    const top = rect.top + rect.height / 2 - cardHeight / 2;
    return {
      top: Math.round(clamp(top, CARD_MARGIN, window.innerHeight - cardHeight - CARD_MARGIN)),
      left: Math.round(clamp(left, SIDE_DOCK_EDGE_MARGIN, window.innerWidth - CARD_WIDTH - SIDE_DOCK_EDGE_MARGIN)),
    };
  }

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const fitsBelow = spaceBelow > cardHeight + CARD_MARGIN;
  const fitsAbove = spaceAbove > cardHeight + CARD_MARGIN;

  let top: number;
  if (fitsBelow) top = rect.bottom + CARD_MARGIN;
  else if (fitsAbove) top = rect.top - cardHeight - CARD_MARGIN;
  else top = window.innerHeight / 2 - cardHeight / 2;

  const left = rect.left + rect.width / 2 - CARD_WIDTH / 2;

  return {
    top: Math.round(clamp(top, CARD_MARGIN, window.innerHeight - cardHeight - CARD_MARGIN)),
    left: Math.round(clamp(left, CARD_MARGIN, window.innerWidth - CARD_WIDTH - CARD_MARGIN)),
  };
}

/** Finds the nearest scrollable ancestor — usually `<main>` (the app shell's own scroll container),
 *  but a step inside a Dialog needs its `DialogContent` (which scrolls internally), not the page
 *  behind it. Falls back to `window` if nothing scrollable is found. */
function findScrollParent(el: HTMLElement): HTMLElement | typeof window {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

/** Scrolls so the target AND the card both actually fit on screen, instead of just centering the
 *  target and hoping — the previous version (`scrollIntoView({ block: "center" })`) knew nothing
 *  about the card's own height, so a tall section (a full stat grid, a form panel) would get centered
 *  right through where the card needed to sit, forcing it into a cramped, overlapping clamp.
 *  When target + card + margins fit the viewport together, scrolls to center that whole GROUP (target
 *  above, card below) as a unit. When the target alone is taller than the viewport has room for, pins
 *  the target's top near the top of the view instead and leaves the bottom strip genuinely clear for
 *  the card to dock in (see `computeCardPosition`'s third branch) — reading from the top of a
 *  spotlighted section matters more than seeing all of it at once. A side-docked step (`isSideDock`,
 *  mirroring `computeCardPosition`'s `preferSide`) doesn't need any of this vertical reserve — the
 *  card sits beside the target, not below it — so it just centers the target itself in the viewport. */
async function alignTargetForCard(el: HTMLElement, cardHeightEstimate: number, isSideDock: boolean): Promise<void> {
  const scrollParent = findScrollParent(el);
  const rect = el.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const reserveForCard = isSideDock ? 0 : cardHeightEstimate + CARD_MARGIN * 2;

  let desiredTop: number;
  if (rect.height + reserveForCard + CARD_MARGIN <= viewportH) {
    const groupHeight = rect.height + reserveForCard;
    desiredTop = (viewportH - groupHeight) / 2;
  } else {
    desiredTop = CARD_MARGIN * 2;
  }

  const deltaY = rect.top - desiredTop;
  if (Math.abs(deltaY) < 4) return;

  // Instant, not `behavior: "smooth"` — a smooth scroll needs its own few hundred ms to settle before
  // the target's rect can be trusted, which was most of the "one second of lag before Next actually
  // does anything" complaint. A guided tour re-orienting the view between steps reads fine as an
  // instant cut; it doesn't need to be its own mini-animation.
  if (scrollParent === window) {
    window.scrollBy({ top: deltaY, behavior: "auto" });
  } else {
    (scrollParent as HTMLElement).scrollBy({ top: deltaY, behavior: "auto" });
  }
}

/** The guided onboarding tour — a genuinely interactive walkthrough (see `tourSteps.ts`'s top-level
 *  doc comment for the interaction model), each step spotlighting one real element on a real page
 *  (via `data-tour="..."` attributes scattered through the app, modals included) with a small card
 *  explaining it plus a concrete example. Mounted once in `App.tsx`, alongside `AddTradeModal`/
 *  `AiTaskAssistant`, so it survives the route changes and modal opens the tour itself triggers.
 *
 *  Two mechanisms, deliberately kept separate:
 *  1. **Blocking the real app** is a single `document.body.style.pointerEvents = "none"` for as long
 *     as `active` is true, with this component's own root re-enabling itself via `pointerEvents:
 *     "auto"`. This is a whole-DOM-tree lock, not a pile of overlay divs trying to cover every pixel —
 *     it's what a Radix Dialog's own portaled content (which renders as a sibling of `#root`, not a
 *     descendant of anything this component draws) actually needs, since no amount of z-index layering
 *     *inside* `TourOverlay` can reach a DOM subtree that lives outside it.
 *  2. **The spotlight visual** is FOUR separate blurred rectangles framing the target
 *     (`computeSpotlightStrips`), not one full-screen overlay with a `box-shadow` cutout — a
 *     `backdrop-filter: blur()` has no way to exclude a hole from itself the way a box-shadow spread
 *     can fake a cutout with a solid color; only an actual DOM gap stays genuinely unblurred. This is
 *     now PURELY cosmetic (see #1 above for why nothing underneath is clickable regardless of how
 *     precisely these four rectangles add up). The pulsating ring is a separate layer on top,
 *     animating only opacity/scale — keeping concerns on separate elements avoids the class of
 *     animation-conflict bug documented elsewhere in this app's CSS.
 *
 *  Entering a step runs, in order: `onEnter` (sync cleanup for whatever a PREVIOUS step's
 *  `preClickSelector` may have opened), a route change if needed, a poll+click on
 *  `preClickSelector` if the step has one (simulating the actual user action — unaffected by the
 *  pointer-events lock, since `element.click()` doesn't go through hit-testing), then a poll+spotlight
 *  on `selector`. Every poll gracefully degrades to a centered, non-spotlit card if its target never
 *  shows up, rather than leaving the tour stuck. */
export function TourOverlay() {
  const active = useTourStore((s) => s.active);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const close = useTourStore((s) => s.close);
  const profileId = useAuthStore((s) => s.currentProfileId);
  const markTutorialSeen = useAuthStore((s) => s.markTutorialSeen);
  const navigate = useNavigate();
  const location = useLocation();

  const [rect, setRect] = useState<DOMRect | null>(null);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardHeightRef = useRef(CARD_HEIGHT_FALLBACK);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_FALLBACK);

  // Measures the card's REAL rendered height after every render (it has real layout even while
  // faded out via opacity — only `display: none` would prevent that) and feeds it back into both
  // positioning functions below. Runs synchronously before paint, so if this render's assumed height
  // was wrong, React re-renders with the corrected value before the browser ever shows the wrong one.
  useLayoutEffect(() => {
    const h = cardRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - cardHeightRef.current) > 1) {
      cardHeightRef.current = h;
      setCardHeight(h);
    }
  });

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const progressPct = Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100);

  async function finish() {
    close();
    markTutorialSeen();
    if (profileId) {
      try {
        await markTutorialComplete(profileId);
      } catch {
        // Best-effort — worst case the tour just offers itself again next login, no real harm done.
      }
    }
  }

  function handleNext() {
    if (isLast) void finish();
    else next();
  }

  function handleSkip() {
    void finish();
  }

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Locks the ENTIRE real app out of pointer interaction for as long as the tour is active — a click
  // anywhere on `<body>` (the shared ancestor of everything, including a Radix Dialog's own portaled
  // content, which lives OUTSIDE this component's own DOM subtree and so can't be reached by any
  // amount of z-index/overlay layering inside `TourOverlay` itself) is structurally unable to reach a
  // real button/input underneath. `pointer-events` is inherited and re-enable-able per element, so the
  // tour's own root div opts itself back in via `pointer-events: auto` below — this is what replaced
  // the earlier "blur strips + a hole-guard div + a full-screen catch-all div" approach, which tried to
  // out-position every possible gap instead of removing the possibility of one. `preClickSelector`'s
  // simulated interactions still work: `element.click()` doesn't go through hit-testing at all, so it's
  // unaffected by `pointer-events` on anything.
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.pointerEvents;
    document.body.style.pointerEvents = "none";
    return () => {
      document.body.style.pointerEvents = previous;
    };
  }, [active]);

  // The main per-step pipeline: onEnter cleanup → route change → preClick → find + spotlight.
  useEffect(() => {
    if (!active || !step) return;
    let cancelled = false;
    setVisible(false);
    setTargetEl(null);
    setRect(null);

    step.onEnter?.();

    if (step.route && location.pathname !== step.route) {
      startTransition(() => navigate(step.route!));
    }

    async function run() {
      if (step.preClickSelector) {
        // No fixed sleep after the click — the `pollFor` right below is already checking every
        // animation frame for `step.selector` to exist, so it picks up whatever the click just opened
        // (a modal, a day panel) as soon as the browser actually renders it, rather than always eating
        // a fixed delay even when the real wait was much shorter.
        await pollFor(() => {
          const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>(step.preClickSelector!));
          const target = candidates.find((el) => !el.disabled) ?? null;
          if (target) target.click();
          return target;
        }, () => cancelled);
      }
      if (cancelled) return;

      if (!step.selector) {
        setVisible(true);
        return;
      }

      // Also re-checks the rect isn't degenerate (near-zero size, or sitting at the exact viewport
      // origin) each poll attempt — a dialog mid-exit-animation (e.g. one Radix just started closing
      // because it wrongly saw a tour click as "outside" — see `ignoreTourOutsideClicks`) can still
      // match the selector for a moment while collapsing toward a corner, and measuring THAT is
      // exactly what put the card in a corner instead of on the real target.
      const el = await pollFor(() => {
        const found = document.querySelector<HTMLElement>(step.selector!);
        if (!found) return null;
        const r = found.getBoundingClientRect();
        return r.width > 10 && r.height > 10 ? found : null;
      }, () => cancelled);
      if (cancelled) return;
      if (!el || isRectTooLarge(el.getBoundingClientRect())) {
        // Either nothing matched, or it matched something that's basically the whole screen (a
        // narrow-window Dialog, most likely) — either way, a clean centered card beats a broken-
        // looking full-viewport ring and a Next button stranded at a screen edge.
        setVisible(true);
        return;
      }
      await alignTargetForCard(el, cardHeightRef.current, !!step.cardSide);
      if (cancelled) return;
      const finalRect = el.getBoundingClientRect();
      if (finalRect.width <= 10 || finalRect.height <= 10 || isRectTooLarge(finalRect)) {
        // Collapsed (or blew up) between the check above and now — fall back to a centered card
        // rather than positioning against garbage or an edge-to-edge rect.
        setVisible(true);
        return;
      }
      setTargetEl(el);
      setRect(finalRect);
      setVisible(true);
    }
    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  // Keep the spotlight glued to its target across resizes/scrolls/content reflow.
  useEffect(() => {
    if (!targetEl) return;
    function update() {
      const r = targetEl!.getBoundingClientRect();
      // If the target collapses (e.g. a dialog it lives in starts closing) or balloons to cover the
      // whole viewport (e.g. the window gets resized down under a Dialog's own max-width), keep
      // showing the last good rect rather than snapping the spotlight to a degenerate or glitchy one
      // — the step-change effect is what handles moving on cleanly, not this tracker.
      if (r.width > 10 && r.height > 10 && !isRectTooLarge(r)) setRect(r);
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const ro = new ResizeObserver(update);
    ro.observe(targetEl);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      ro.disconnect();
    };
  }, [targetEl]);

  if (!active || !step) return null;

  const { top: cardTop, left: cardLeft } = computeCardPosition(rect, cardHeight, step.cardSide);
  const Icon = step.icon;
  const strips = rect ? computeSpotlightStrips(rect, SPOTLIGHT_PADDING) : null;

  return (
    <div className="fixed inset-0 z-[200]" data-tour-overlay aria-live="polite" style={{ pointerEvents: "auto" }}>
      {/* No click-blocking divs here anymore — the real app is structurally unclickable underneath
          (see the `document.body.style.pointerEvents` effect above), so these strips are purely
          visual now: blur everywhere except a clear rectangle around the target. `onClick={handleSkip}`
          is just the "tap the dimmed background to skip" convenience, not load-bearing for safety. */}
      {strips ? (
        strips.map((s, i) => (
          <div
            key={i}
            className="absolute backdrop-blur-md transition-all duration-200 ease-out"
            style={{ top: s.top, left: s.left, width: s.width, height: s.height, background: "rgba(8,5,18,0.55)" }}
            onClick={handleSkip}
          />
        ))
      ) : (
        <div
          className="absolute inset-0 backdrop-blur-md transition-opacity duration-200"
          style={{ background: "rgba(8,5,18,0.74)" }}
          onClick={handleSkip}
        />
      )}

      {rect && (
        <>
          {/* A soft, wide ambient glow sitting BEHIND the sharp ring — its own static layer (no
              animation) so the pulsing ring on top doesn't need to carry the whole "glow" job alone.
              Two layers reads as a richer "energy field" than one line pulsing by itself. */}
          <div
            className="pointer-events-none absolute rounded-2xl transition-all duration-200 ease-out"
            style={{
              top: rect.top - SPOTLIGHT_PADDING - 8,
              left: rect.left - SPOTLIGHT_PADDING - 8,
              width: rect.width + SPOTLIGHT_PADDING * 2 + 16,
              height: rect.height + SPOTLIGHT_PADDING * 2 + 16,
              background: "radial-gradient(ellipse at center, rgba(139,92,246,0.16), transparent 70%)",
            }}
          />
          <div
            className="animate-tour-pulse pointer-events-none absolute rounded-xl"
            style={{
              top: rect.top - SPOTLIGHT_PADDING,
              left: rect.left - SPOTLIGHT_PADDING,
              width: rect.width + SPOTLIGHT_PADDING * 2,
              height: rect.height + SPOTLIGHT_PADDING * 2,
              border: "2px solid #a78bfa",
              boxShadow: "0 0 32px 4px rgba(139,92,246,0.6), inset 0 0 20px -6px rgba(167,139,250,0.5)",
            }}
          />
        </>
      )}

      <div
        ref={cardRef}
        data-tour-card
        className={cn(
          "absolute overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--color-surface)] shadow-[0_28px_80px_-16px_rgba(0,0,0,0.7),0_0_0_1px_rgba(139,92,246,0.15)] transition-all duration-200 ease-out",
          visible ? "scale-100 opacity-100 translate-y-0" : "pointer-events-none scale-[0.98] opacity-0 translate-y-1",
        )}
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
      >
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #8b5cf6, #d946ef, #ec4899)" }} />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ring-1 ring-inset ring-white/20"
                style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed 55%, #6d28d9)", boxShadow: "0 4px 16px -2px rgba(124,58,237,0.6)" }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-[var(--color-text)]">{step.title}</h2>
            </div>
            <button
              onClick={handleSkip}
              className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text)]"
              aria-label="Skip tour"
            >
              Skip
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">{step.body}</p>

          <div
            className="mt-3 rounded-lg border px-3 py-2"
            style={{ borderColor: "rgba(139,92,246,0.25)", background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.05))" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#c4b5fd]">Example</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text)]">{step.example}</p>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <span>
                Step {stepIndex + 1} of {TOUR_STEPS.length}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #8b5cf6, #d946ef, #ec4899)" }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            {stepIndex > 0 ? (
              <button
                onClick={back}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/15 transition-transform hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed 55%, #6d28d9)", boxShadow: "0 6px 18px -4px rgba(124,58,237,0.6)" }}
            >
              {isLast ? "Finish" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
