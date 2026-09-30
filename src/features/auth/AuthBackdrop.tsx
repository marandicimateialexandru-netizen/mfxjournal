import { useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type GlyphType =
  | "equity"
  | "bars"
  | "calendar"
  | "candles"
  | "ring"
  | "tag"
  | "layers"
  | "table"
  | "donut"
  | "gauge"
  | "target"
  | "checklist"
  | "trend"
  | "clock"
  | "coins"
  | "flag"
  | "stat";

/** One small representative glyph per major part of the app — Dashboard (ring/donut/gauge), Journal
 *  (table/candles), Planning (calendar), AI Advisor (equity/bars), Report (bars), Variables (tag),
 *  Strategy (layers) — so the backdrop reads as "glimpses of everything in here," not one repeated
 *  motif. Gradient fills instead of flat colors for a richer look — cheap (just an SVG paint, no
 *  filter), unlike the drop-shadow glows used sparingly elsewhere in this sequence only for one-shot
 *  moments (a filter re-rasterizing dozens of continuously-animating elements every frame would
 *  reintroduce the exact sidebar-lag class of bug already fixed once this session). `seed` varies
 *  the exact shape/values so copies of the same type don't look identical. */
function Glyph({ type, seed, color, colorB, gradId }: { type: GlyphType; seed: number; color: string; colorB: string; gradId: string }) {
  const grad = (
    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} />
      <stop offset="100%" stopColor={colorB} />
    </linearGradient>
  );
  const fill = `url(#${gradId})`;

  switch (type) {
    case "equity":
      return (
        <svg viewBox="0 0 160 90" fill="none" className="h-full w-full">
          <defs>{grad}</defs>
          <polyline points="4,70 28,58 48,62 70,38 92,44 116,20 140,26 156,10" stroke={fill} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx={140} cy={26} r="3.5" fill={color} />
        </svg>
      );
    case "bars":
      return (
        <svg viewBox="0 0 120 70" fill="none" className="h-full w-full">
          <defs>{grad}</defs>
          {[14, 34, 54, 74, 94].map((x, i) => {
            const h = [30, 48, 22, 58, 38][(i + seed) % 5];
            return <rect key={x} x={x} y={70 - h} width="14" height={h} rx="3" fill={fill} />;
          })}
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 96 96" fill="none" className="h-full w-full">
          {Array.from({ length: 16 }).map((_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const isHighlight = i === (seed % 16) || i === (seed * 3 + 2) % 16;
            return (
              <rect key={i} x={col * 24 + 2} y={row * 24 + 2} width="20" height="20" rx="4" fill={isHighlight ? color : "none"} stroke={isHighlight ? "none" : color} strokeWidth="1.5" />
            );
          })}
        </svg>
      );
    case "candles":
      return (
        <svg viewBox="0 0 100 100" fill="none" className="h-full w-full">
          <line x1="20" y1="30" x2="20" y2="80" stroke={color} strokeWidth="6" strokeLinecap="round" />
          <rect x="10" y="45" width="20" height="28" rx="4" fill={color} />
          <line x1="50" y1="15" x2="50" y2="75" stroke={colorB} strokeWidth="6" strokeLinecap="round" opacity="0.85" />
          <rect x="40" y="30" width="20" height="35" rx="4" fill={colorB} opacity="0.85" />
          <line x1="80" y1="5" x2="80" y2="65" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.55" />
          <rect x="70" y="18" width="20" height="42" rx="4" fill={color} opacity="0.55" />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 36 36" fill="none" className="h-full w-full">
          <defs>{grad}</defs>
          <circle cx="18" cy="18" r="15" stroke={color} strokeOpacity="0.25" strokeWidth="3" fill="none" />
          <circle
            cx="18"
            cy="18"
            r="15"
            stroke={fill}
            strokeWidth="3"
            strokeDasharray={`${40 + (seed % 40)} 100`}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(${(seed * 47) % 360} 18 18)`}
          />
        </svg>
      );
    case "donut":
      return (
        <svg viewBox="0 0 36 36" fill="none" className="h-full w-full">
          <defs>{grad}</defs>
          <circle
            cx="18"
            cy="18"
            r="15"
            stroke={colorB}
            strokeOpacity="0.3"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${20 + (seed % 20)} 100`}
            transform={`rotate(${(seed * 29) % 360} 18 18)`}
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            stroke={fill}
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${45 + (seed % 25)} 100`}
            strokeDashoffset={-(20 + (seed % 20))}
            strokeLinecap="round"
            transform={`rotate(${(seed * 29 - 90) % 360} 18 18)`}
          />
        </svg>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 40 24" fill="none" className="h-full w-full">
          <defs>{grad}</defs>
          <path d="M4,22 A18,18 0 0,1 36,22" stroke={color} strokeOpacity="0.25" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M4,22 A18,18 0 0,1 36,22" stroke={fill} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={`${30 + (seed % 40)} 100`} />
          <circle cx="20" cy="22" r="2" fill={color} />
        </svg>
      );
    case "tag":
      return (
        <svg viewBox="0 0 60 40" fill="none" className="h-full w-full">
          <path d="M4,10 L36,10 L56,20 L36,30 L4,30 Z" stroke={color} strokeWidth="3" fill="none" strokeLinejoin="round" />
          <circle cx="14" cy="20" r="3" fill={color} />
        </svg>
      );
    case "layers":
      return (
        <svg viewBox="0 0 60 60" fill="none" className="h-full w-full">
          <rect x="4" y="28" width="52" height="24" rx="4" stroke={color} strokeWidth="3" fill="none" />
          <rect x="10" y="16" width="40" height="24" rx="4" stroke={colorB} strokeWidth="3" fill="none" opacity="0.8" />
          <rect x="16" y="4" width="28" height="24" rx="4" fill={color} opacity="0.55" />
        </svg>
      );
    case "table":
      return (
        <svg viewBox="0 0 100 60" fill="none" className="h-full w-full">
          {[8, 22, 36, 50].map((y, i) => (
            <line key={y} x1="4" y1={y} x2={i % 2 === 0 ? 96 : 70} y2={y} stroke={color} strokeWidth="4" strokeLinecap="round" opacity={1 - i * 0.15} />
          ))}
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 60 60" fill="none" className="h-full w-full">
          <circle cx="30" cy="30" r="26" stroke={color} strokeWidth="3" fill="none" opacity="0.4" />
          <circle cx="30" cy="30" r="17" stroke={color} strokeWidth="3" fill="none" opacity="0.7" />
          <circle cx="30" cy="30" r="7" fill={color} />
        </svg>
      );
    case "checklist":
      return (
        <svg viewBox="0 0 100 70" fill="none" className="h-full w-full">
          {[8, 30, 52].map((y, i) => (
            <g key={y}>
              <rect x="0" y={y} width="14" height="14" rx="3" stroke={color} strokeWidth="2.5" fill={i !== 1 ? color : "none"} />
              {i !== 1 && <path d={`M4,${y + 7.5} l2.5,3.5 l6.5,-7`} stroke="#0d0d14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
              <line x1="24" y1={y + 7} x2="96" y2={y + 7} stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
            </g>
          ))}
        </svg>
      );
    case "trend":
      return (
        <svg viewBox="0 0 100 60" fill="none" className="h-full w-full">
          <defs>{grad}</defs>
          <path d="M4,50 L34,26 L54,38 L96,4" stroke={fill} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M72,4 L96,4 L96,28" stroke={fill} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 60 60" fill="none" className="h-full w-full">
          <circle cx="30" cy="30" r="26" stroke={color} strokeWidth="3" fill="none" />
          <line x1="30" y1="30" x2="30" y2={14 + (seed % 6)} stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="30" y1="30" x2={38 + (seed % 8)} y2={34 - (seed % 6)} stroke={color} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "coins":
      return (
        <svg viewBox="0 0 80 60" fill="none" className="h-full w-full">
          <defs>{grad}</defs>
          <circle cx="26" cy="36" r="20" fill={fill} opacity="0.85" />
          <circle cx="52" cy="22" r="20" stroke={color} strokeWidth="3" fill="none" />
        </svg>
      );
    case "flag":
      return (
        <svg viewBox="0 0 50 70" fill="none" className="h-full w-full">
          <line x1="6" y1="4" x2="6" y2="66" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="M6,6 L44,14 L30,24 L44,34 L6,42 Z" fill={color} opacity="0.85" />
        </svg>
      );
    case "stat":
    default:
      return null;
  }
}

const STAT_LABELS = ["+2.4R", "68% WR", "1.9 PF", "+14.2R", "72% WR", "-0.8R", "2.3 PF", "+6.1R", "0.42R", "89 trades", "+31.6R", "54% WR"];

// Tuning for the `converging` gravitational-pull effect: elements nearer the center start drifting in
// almost immediately, further-out ones start later — `distFromCenter * CONVERGE_DELAY_PER_UNIT`, capped
// at `CONVERGE_MAX_DELAY_MS` — so the pull reads as spreading outward from the middle rather than every
// element snapping off in lockstep. Every element ALSO gets its own random duration
// (`CONVERGE_DURATION_MIN_MS`–`CONVERGE_DURATION_MAX_MS`) and its own slightly randomized easing curve
// (`randomConvergeEasing`), so no two elements trace the same speed profile even if they happened to
// start at the same moment — genuinely "flowing differently," not just offset copies of one motion.
// `CONVERGE_MAX_DELAY_MS + CONVERGE_DURATION_MAX_MS` must equal `CosmicTransition.tsx`'s `CONVERGE_MS`
// — otherwise the flash can fire before the slowest, furthest-out element actually arrives.
// A later pass cut this much further (down to 6/400/700/1000) chasing complaints about the overall
// login→book wait, but that wait was actually coming from elsewhere (the book's own materialize
// duration, plus a couple of real bugs) — the gathering itself was explicitly liked at this slower,
// more dramatic pace and shouldn't have been rushed. Reverted to this pace.
const CONVERGE_DELAY_PER_UNIT = 9;
const CONVERGE_MAX_DELAY_MS = 650;
const CONVERGE_DURATION_MIN_MS = 1100;
const CONVERGE_DURATION_MAX_MS = 1700;

function distFromCenter(left: number, top: number): number {
  return Math.hypot(left - 50, top - 50);
}

function convergeDelayFor(left: number, top: number): number {
  return Math.min(distFromCenter(left, top) * CONVERGE_DELAY_PER_UNIT, CONVERGE_MAX_DELAY_MS);
}

function randomConvergeDuration(): number {
  return CONVERGE_DURATION_MIN_MS + Math.random() * (CONVERGE_DURATION_MAX_MS - CONVERGE_DURATION_MIN_MS);
}

/** A per-element easing curve, randomized around a base "ease-in" shape (steep, gravity-like
 *  acceleration) — some elements accelerate harder/later than others, so the field doesn't move as one
 *  matched motion even where two elements share a similar delay and duration. */
function randomConvergeEasing(): string {
  const x1 = 0.3 + Math.random() * 0.35;
  const y2 = 0.75 + Math.random() * 0.25;
  return `cubic-bezier(${x1.toFixed(2)}, 0, 0.94, ${y2.toFixed(2)})`;
}

// The one-time staggered "reveal" that plays right as the flash finishes and the backdrop needs to
// repopulate — icons fade in one by one instead of all appearing at once. `REVEAL_FADE_MS` must match
// `index.css`'s `authReappear` duration, and `BACKDROP_REVEAL_MS` (exported so `App.tsx` knows when to
// stop asking for "revealing" mode and settle into plain "walk") must be at least
// `REVEAL_MAX_STAGGER_MS + REVEAL_FADE_MS` so the slowest icon actually finishes fading in.
const REVEAL_MAX_STAGGER_MS = 1800;
const REVEAL_FADE_MS = 500;
export const BACKDROP_REVEAL_MS = REVEAL_MAX_STAGGER_MS + REVEAL_FADE_MS;

export type BackdropMode = "walk" | "converging" | "revealing";

interface GlyphSpec {
  type: GlyphType;
  left: number;
  top: number;
  riseTop: number;
  size: number;
  color: string;
  colorB: string;
  delay: string;
  duration: string;
  walkX: string;
  seed: number;
  revealDelayMs: number;
  convergeDelayMs: number;
  convergeDurationMs: number;
  convergeEasing: string;
  convergeJitterX: number;
  convergeJitterY: number;
  tumbleDeg: number;
}

/** A rise animation's delay/duration pair for the idle "walk" state — negative delay is the trick that
 *  makes it look like an already-running infinite loop from the very first frame: it tells the browser
 *  the animation "started" that many seconds in the past, so the element renders already mid-flight at
 *  a random point along its rise instead of popping in from its 0% keyframe. Every element's phase is
 *  independently randomized this way, so the field never reads as a synchronized batch. */
function randomRise(durationSec: number): { delay: string; duration: string } {
  return { delay: `-${(Math.random() * durationSec).toFixed(2)}s`, duration: `${durationSec.toFixed(2)}s` };
}

/** Places one glyph per grid cell (with jitter inside the cell) instead of a scatter formula — a
 *  scatter formula can (and did) leave visible empty bands depending on how its constants happen to
 *  interact with a given count; a grid guarantees full-screen coverage while the per-cell jitter
 *  still keeps it looking organic, not like a visible grid. Which glyph type/color/label lands in
 *  each cell is genuinely randomized (`Math.random()`, not an index formula) and this whole field is
 *  rebuilt fresh every time the component mounts (see the `useMemo` below) — so no two visits to the
 *  login/boot screen show the same arrangement of icons and numbers. `top` starts just below the
 *  visible area — every glyph rises straight up off-screen and loops (see `.animate-auth-walk` in
 *  `index.css`), so the reset always happens while it's invisible below the bottom edge, never a
 *  visible pop/fade like the old cycle had. */
function buildField(): GlyphSpec[] {
  const types: GlyphType[] = [
    "equity",
    "bars",
    "calendar",
    "candles",
    "ring",
    "tag",
    "layers",
    "table",
    "donut",
    "gauge",
    "target",
    "checklist",
    "trend",
    "clock",
    "coins",
    "flag",
    "stat",
    "stat",
  ];
  const colorPairs: [string, string][] = [
    ["#a78bfa", "#6d28d9"],
    ["#f472b6", "#be185d"],
    ["#34d399", "#059669"],
    ["#8b5cf6", "#4c1d95"],
    ["#c4b5fd", "#7c3aed"],
    ["#fb7185", "#9f1239"],
    ["#67e8f9", "#0891b2"],
    ["#fde047", "#ca8a04"],
  ];
  const cols = 12;
  const rows = 8;
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const specs: GlyphSpec[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const type = types[Math.floor(Math.random() * types.length)];
    const [color, colorB] = colorPairs[Math.floor(Math.random() * colorPairs.length)];
    const jitterX = (Math.random() - 0.5) * cellW * 0.75;
    const jitterY = (Math.random() - 0.5) * cellH * 0.75;
    const left = Math.max(2, Math.min(98, col * cellW + cellW / 2 + jitterX));
    const top = Math.max(2, Math.min(94, row * cellH + cellH / 2 + jitterY));
    const durationSec = 11 + Math.random() * 9;
    specs.push({
      type,
      left,
      top,
      riseTop: 101 + Math.random() * 16,
      size: type === "stat" ? 0 : 46 + Math.floor(Math.random() * 38),
      color,
      colorB,
      ...randomRise(durationSec),
      walkX: `${(Math.random() - 0.5) * 70}px`,
      seed: Math.floor(Math.random() * 100000),
      revealDelayMs: Math.random() * REVEAL_MAX_STAGGER_MS,
      convergeDelayMs: convergeDelayFor(left, top),
      convergeDurationMs: randomConvergeDuration(),
      convergeEasing: randomConvergeEasing(),
      convergeJitterX: (Math.random() - 0.5) * 7,
      convergeJitterY: (Math.random() - 0.5) * 7,
      tumbleDeg: (Math.random() - 0.5) * 220,
    });
  }
  return specs;
}

function buildParticles() {
  const cols = 10;
  const rows = 6;
  const cellW = 100 / cols;
  const cellH = 45 / rows;
  const colors = ["#a78bfa", "#f472b6", "#34d399", "#8b5cf6", "#67e8f9", "#fde047"];
  return Array.from({ length: cols * rows }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = (Math.random() - 0.5) * cellW * 0.8;
    const left = Math.max(1, Math.min(99, col * cellW + cellW / 2 + jitterX));
    const bottom = row * cellH + Math.random() * 9;
    const durationSec = 4.5 + Math.random() * 5.5;
    return {
      left,
      bottom,
      riseBottom: -(2 + Math.random() * 16),
      ...randomRise(durationSec),
      size: 2 + Math.floor(Math.random() * 3),
      color: colors[Math.floor(Math.random() * colors.length)],
      revealDelayMs: Math.random() * REVEAL_MAX_STAGGER_MS,
      convergeDelayMs: convergeDelayFor(left, 100 - bottom),
      convergeDurationMs: randomConvergeDuration(),
      convergeEasing: randomConvergeEasing(),
      convergeJitterX: (Math.random() - 0.5) * 6,
      convergeJitterY: (Math.random() - 0.5) * 6,
      tumbleDeg: (Math.random() - 0.5) * 180,
    };
  });
}

interface StarSpec {
  left: number;
  top: number;
  size: number;
  convergeDelayMs: number;
  convergeDurationMs: number;
  convergeEasing: string;
  convergeJitterX: number;
  convergeJitterY: number;
  tumbleDeg: number;
}

/** A dense field of tiny plain points — no icon shape, just light — that only ever exists during the
 *  `converging` beat (never part of the ordinary idle backdrop). On top of the 54 glyphs + 32 particles
 *  already drifting in, this reads as a genuine star CLUSTER collapsing inward, the way you'd picture
 *  a few dozen icons *not* being enough to sell "gravity pulling in a swarm of stars to form a black
 *  hole." Randomly scattered (not grid-based) since at this density a plain random scatter already
 *  covers the screen evenly with no visible gaps, and true randomness suits "stars" better than a grid.
 *  Every star gets its own random duration and easing curve on top of its own delay/jitter/tumble (see
 *  `randomConvergeDuration`/`randomConvergeEasing`), so with 210 of them no two are visibly moving in
 *  sync — each one genuinely flows toward the center on its own path and pace. */
function buildStars(): StarSpec[] {
  const count = 210;
  return Array.from({ length: count }, () => {
    const left = Math.random() * 100;
    const top = Math.random() * 100;
    return {
      left,
      top,
      size: 1 + Math.random() * 1.6,
      convergeDelayMs: convergeDelayFor(left, top),
      convergeDurationMs: randomConvergeDuration(),
      convergeEasing: randomConvergeEasing(),
      convergeJitterX: (Math.random() - 0.5) * 4,
      convergeJitterY: (Math.random() - 0.5) * 4,
      tumbleDeg: (Math.random() - 0.5) * 200,
    };
  });
}

/** The ambient decoration behind every screen in the boot/login/book sequence — a dense field (96
 *  glyphs across 17 types + 60 particles) of small representative glimpses of every part of the app,
 *  all rising straight up off-screen on a slow, continuous, independently-timed loop and looping
 *  seamlessly (see `.animate-auth-walk`/`.animate-auth-particle` in `index.css`) — no fade-in, no pop,
 *  since every element starts and loops back below the visible bottom edge and each one's negative
 *  `animation-delay` (see `randomRise`) puts it at its own random phase of that rise from the very
 *  first frame, so the field looks like an already-running infinite loop rather than a batch that all
 *  spawns/resets together. Everything here is decorative/placeholder data — this component never
 *  touches the database. Pure transform, no `filter: blur()`, so it's cheap to keep mounted.
 *
 *  `mode="converging"`, used only during `CosmicTransition`'s gravitational-pull beat, swaps every
 *  element's normal rise for a one-shot drift toward roughly the center — like loose debris actually
 *  being pulled in, not a choreographed group effect — and additionally mounts 210 plain little "star"
 *  points (see `buildStars`) that don't exist at all outside this beat, so the gathering reads as an
 *  actual star cluster collapsing into a black hole rather than just the usual 156 app-glyphs/particles
 *  drifting in. Every one of those 366 elements gets its own random landing jitter (it lands near, not
 *  exactly on, the center point), its own random tumble rotation, its own random DURATION, and its own
 *  randomized EASING curve (see `randomConvergeDuration`/`randomConvergeEasing`) — so nothing here moves
 *  as one matched, synchronized shape; every piece is visibly tracing its own independent path at its
 *  own pace. `--center-dx`/`--center-dy` bake the landing jitter in (computed per element from its own
 *  position, in viewport units, since this overlay fills the screen), and the start delay is based on
 *  each element's own distance from center — the ones already near the middle start drifting in first,
 *  the further-out ones join in later, like the pull is spreading outward from the middle rather than
 *  everything snapping off at once.
 *
 *  `mode="revealing"` is the one-time beat right after the flash, when the field needs to repopulate —
 *  every element fades back in at its own random staggered moment (`revealDelayMs`, via the
 *  `authReappear` keyframe, opacity only) while its normal rise animation keeps running underneath the
 *  whole time (untouched, on `transform` — the two animations run concurrently since they touch
 *  different properties, so they never fight each other), so icons visibly pop back into existence one
 *  by one instead of the whole field appearing as a single block. Once every element's reveal has
 *  finished (`BACKDROP_REVEAL_MS`), the caller switches back to `mode="walk"`, which changes nothing
 *  visually (everything's already sitting at full opacity) — it just drops the now-finished reveal
 *  animation.
 *
 *  This whole component is deliberately mounted ONCE, at the top of `App.tsx`, and stays mounted for
 *  the entire intro → auth → cosmic → book sequence — it used to be re-instantiated fresh inside each
 *  of those four screens, which meant every phase transition silently reshuffled every icon to a brand
 *  new random layout, reading as a jarring "hard reset" instead of a continuous background. Now the
 *  SAME field/particles/stars persist across the whole sequence; only `mode` changes. */
export function AuthBackdrop({ mode = "walk" }: { mode?: BackdropMode }) {
  const particles = useMemo(buildParticles, []);
  const field = useMemo(buildField, []);
  const stars = useMemo(buildStars, []);
  const converging = mode === "converging";
  const revealing = mode === "revealing";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.16]">
      {converging &&
        stars.map((s, i) => (
          <span
            key={`star-${i}`}
            className="animate-converge-to-center absolute rounded-full bg-white"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              ["--center-dx" as string]: `calc(50vw - ${s.left}vw + ${s.convergeJitterX}vw)`,
              ["--center-dy" as string]: `calc(50vh - ${s.top}vh + ${s.convergeJitterY}vh)`,
              ["--tumble" as string]: `${s.tumbleDeg}deg`,
              animationDelay: `${s.convergeDelayMs}ms`,
              animationDuration: `${s.convergeDurationMs}ms`,
              animationTimingFunction: s.convergeEasing,
            }}
          />
        ))}

      {particles.map((p, i) => {
        const style: CSSProperties = converging
          ? {
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              ["--center-dx" as string]: `calc(50vw - ${p.left}vw + ${p.convergeJitterX}vw)`,
              ["--center-dy" as string]: `calc(50vh - ${100 - p.bottom}vh + ${p.convergeJitterY}vh)`,
              ["--tumble" as string]: `${p.tumbleDeg}deg`,
              animationDelay: `${p.convergeDelayMs}ms`,
              animationDuration: `${p.convergeDurationMs}ms`,
              animationTimingFunction: p.convergeEasing,
            }
          : revealing
            ? {
                left: `${p.left}%`,
                bottom: `${p.riseBottom}%`,
                // `authParticleDrift` MUST be listed first (matching its list position when plain
                // "walk" mode later applies it alone via `.animate-auth-particle`) — browsers match/
                // continue a running CSS animation by its position in the `animation-name` list, not
                // just its name, so having it at index 1 here and index 0 in plain walk mode caused it
                // to be treated as a brand new animation and restart from 0% the instant "revealing"
                // settles into "walk", snapping every icon back to its base position mid-view. Putting
                // it first in both keeps it continuous; `authReappear` (opacity-only, one-shot) can
                // safely come or go in the second slot without disturbing it.
                animation: `authParticleDrift ${p.duration} linear ${p.delay} infinite, authReappear ${REVEAL_FADE_MS}ms ease-out ${p.revealDelayMs.toFixed(0)}ms both`,
              }
            : {
                left: `${p.left}%`,
                bottom: `${p.riseBottom}%`,
                animationDelay: p.delay,
                animationDuration: p.duration,
              };
        return (
          <span
            key={`p-${i}`}
            className={cn("absolute rounded-full", converging ? "animate-converge-to-center" : !revealing && "animate-auth-particle")}
            style={{ width: p.size, height: p.size, background: p.color, ...style }}
          />
        );
      })}

      {field.map((g, i) => {
        const walkStyle: CSSProperties = {
          left: `${g.left}%`,
          top: `${g.riseTop}%`,
          animationDelay: g.delay,
          ["--walk-duration" as string]: g.duration,
          ["--walk-x" as string]: g.walkX,
        };
        // `authWalkDrift` MUST be listed first (matching its list position when plain "walk" mode
        // later applies it alone via `.animate-auth-walk`) — see the matching comment on the particle
        // branch above for why: browsers match/continue a running animation by its position in the
        // `animation-name` list, so having it at index 1 here and index 0 in plain walk mode caused
        // every glyph to snap back to its base position and restart its climb the instant "revealing"
        // settled into "walk" — right while the book is on screen.
        const revealStyle: CSSProperties = {
          left: `${g.left}%`,
          top: `${g.riseTop}%`,
          ["--walk-x" as string]: g.walkX,
          animation: `authWalkDrift ${g.duration} linear ${g.delay} infinite, authReappear ${REVEAL_FADE_MS}ms ease-out ${g.revealDelayMs.toFixed(0)}ms both`,
        };
        const centerStyle: CSSProperties = {
          left: `${g.left}%`,
          top: `${g.top}%`,
          ["--center-dx" as string]: `calc(50vw - ${g.left}vw + ${g.convergeJitterX}vw)`,
          ["--center-dy" as string]: `calc(50vh - ${g.top}vh + ${g.convergeJitterY}vh)`,
          ["--tumble" as string]: `${g.tumbleDeg}deg`,
          animationDelay: `${g.convergeDelayMs}ms`,
          animationDuration: `${g.convergeDurationMs}ms`,
          animationTimingFunction: g.convergeEasing,
        };
        const style = converging ? centerStyle : revealing ? revealStyle : walkStyle;
        const walkClass = !converging && !revealing && "animate-auth-walk";
        if (g.type === "stat") {
          return (
            <span key={i} className={cn("absolute text-lg font-bold", converging ? "animate-converge-to-center" : walkClass)} style={{ ...style, color: g.color }}>
              {STAT_LABELS[g.seed % STAT_LABELS.length]}
            </span>
          );
        }
        return (
          <div key={i} className={cn("absolute", converging ? "animate-converge-to-center" : walkClass)} style={{ ...style, width: g.size, height: g.size }}>
            <Glyph type={g.type} seed={g.seed} color={g.color} colorB={g.colorB} gradId={`auth-glyph-${g.seed}`} />
          </div>
        );
      })}
    </div>
  );
}
