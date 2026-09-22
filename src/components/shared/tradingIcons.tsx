import type { CSSProperties } from "react";
import type { IconComponent, IconTone } from "@/components/shared/IconBadge";

interface IconProps {
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

/** Shared soft drop-shadow — every icon's primary shape gets a little lift off the badge. Filter defs are
 * identical across instances, so duplicate ids across sibling <svg>s are harmless (browsers resolve the first match). */
function Defs() {
  return (
    <defs>
      <filter id="ta-lift" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0.6" stdDeviation="0.55" floodColor="#000" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}

const svgBase = { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" };
const lineBase = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Compass rose with a bold glass-cut needle — trade direction / bias. */
function DirectionIcon({ className, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <circle cx="12" cy="12" r="9.5" fill="currentColor" fillOpacity="0.14" />
      <circle cx="12" cy="12" r="9.5" {...lineBase} strokeWidth={strokeWidth} strokeOpacity="0.55" />
      <g opacity="0.6">
        <path d="M12 3.4v2.1M12 18.5v2.1M3.4 12h2.1M18.5 12h2.1" {...lineBase} strokeWidth={strokeWidth * 0.85} />
      </g>
      <g filter="url(#ta-lift)">
        <polygon points="12,5.2 15,12 12,18.8 9,12" fill="currentColor" fillOpacity="0.5" />
        <polygon points="12,5.2 15,12 12,12" fill="currentColor" />
      </g>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** A bold breakout chevron tearing upward through a fading motion trail — displacement. */
function DisplacementIcon({ className, style, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <g opacity="0.35" {...lineBase} strokeWidth={strokeWidth}>
        <path d="M2.5 19 L7 13.5" />
        <path d="M5 20.5 L9.5 15" />
      </g>
      <g filter="url(#ta-lift)">
        <path d="M4 20 L10 12.5 L13.5 15.2 L20 5.5" fill="none" stroke="currentColor" strokeWidth={strokeWidth + 0.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 5.5H20V12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="10" cy="12.5" r="1.15" fill="currentColor" />
      <circle cx="13.5" cy="15.2" r="1.15" fill="currentColor" />
    </svg>
  );
}

/** Three unmistakable candles — a low one, the big displacement candle bridging the move, and a high one —
 * with the untouched price range between them boxed off as a glowing gap. Fair value gap. */
function FvgIcon({ className, style }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      {/* the gap: the price range candle 1's high and candle 3's low never traded */}
      <rect x="3.6" y="8.4" width="16.8" height="5.6" rx="0.8" fill="currentColor" fillOpacity="0.24" />
      <rect x="3.6" y="8.4" width="16.8" height="5.6" rx="0.8" fill="none" stroke="currentColor" strokeOpacity="0.9" strokeDasharray="1.7 1.7" strokeWidth="1.2" />
      <g filter="url(#ta-lift)">
        {/* candle 1 — before, low */}
        <line x1="6" y1="14" x2="6" y2="19.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="4.7" y="14.6" width="2.6" height="4" rx="0.6" fill="currentColor" fillOpacity="0.6" />
        {/* candle 2 — the displacement candle that skips clean over the gap */}
        <line x1="12" y1="3.4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="10.7" y="4.6" width="2.6" height="13.6" rx="0.8" fill="currentColor" />
        {/* candle 3 — after, high */}
        <line x1="18" y1="3.8" x2="18" y2="8.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="16.7" y="4.6" width="2.6" height="3.6" rx="0.6" fill="currentColor" fillOpacity="0.6" />
      </g>
    </svg>
  );
}

/** A resting liquidity pool swept by a bold glassy wave. */
function LiquidityIcon({ className, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <path d="M3 7.6h18" {...lineBase} strokeWidth={strokeWidth} strokeOpacity="0.55" strokeDasharray="1.6 2" />
      <g filter="url(#ta-lift)">
        <path
          d="M2.5 12.5c1.8 2.4 4 2.4 5.8 0s4-2.4 5.8 0 4 2.4 5.8 0"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth + 0.6}
          strokeLinecap="round"
        />
        <path
          d="M2.5 12.5c1.8 2.4 4 2.4 5.8 0s4-2.4 5.8 0 4 2.4 5.8 0 V19 H2.5 Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
      </g>
      <path d="M12 15.3v4.8" {...lineBase} strokeWidth={strokeWidth} />
      <path d="M9 18 12 21.5 15 18" {...lineBase} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** The textbook break-of-structure diagram: price swings up to touch the old high, pulls back to a higher
 * low, then drives straight through it — a bold solid waypoint stamped right on the break. Market structure shift. */
function MssIcon({ className, style, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      {/* the prior structure level — only the relevant stretch, kept quiet so the break reads as the focal point */}
      <line x1="7.5" y1="8" x2="18.3" y2="8" stroke="currentColor" strokeWidth={strokeWidth * 0.6} strokeOpacity="0.4" strokeDasharray="1.7 1.7" strokeLinecap="round" />
      <g filter="url(#ta-lift)">
        {/* low -> swing high (touches the level) -> higher low -> breaks clean through it */}
        <path
          d="M2.3 19 L7.5 8 L12.3 13.5 L18.3 3.8"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth + 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15.1 3.8H18.3V7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* the break, one bold solid waypoint right where the final leg crosses the old level */}
      <circle cx="15.8" cy="8" r="2.3" fill="currentColor" />
    </svg>
  );
}

/** A folded newspaper page, dog-eared corner and headline bar up top, with a live stock chart — candles and
 * a flowing trend line — printed across the bottom half. News events. */
function NewsIcon({ className, style }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <g filter="url(#ta-lift)">
        <rect x="3.3" y="4.3" width="17.4" height="16" rx="1.6" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.3" />
      </g>
      {/* dog-eared folded corner */}
      <path d="M15.3 4.3H20.7V9.7Z" fill="currentColor" fillOpacity="0.4" />
      <path d="M15.3 4.3 20.7 9.7" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
      {/* headline + byline */}
      <rect x="5" y="6.6" width="8" height="1.8" rx="0.4" fill="currentColor" opacity="0.9" />
      <line x1="5" y1="9.8" x2="12.6" y2="9.8" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="5" y1="11.4" x2="11" y2="11.4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* the stock chart printed on the page: candles + a flowing trend line */}
      <g filter="url(#ta-lift)">
        <line x1="6.2" y1="17.6" x2="6.2" y2="19.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="5.4" y="18" width="1.6" height="1.4" rx="0.35" fill="currentColor" fillOpacity="0.55" />
        <line x1="10.3" y1="13.4" x2="10.3" y2="19.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="9.5" y="14" width="1.6" height="4.6" rx="0.35" fill="currentColor" />
        <line x1="14.4" y1="15.7" x2="14.4" y2="19.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="13.6" y="16.2" width="1.6" height="2.7" rx="0.35" fill="currentColor" fillOpacity="0.55" />
        <path d="M6.2 17.7 10.3 13.6 14.4 16 18.3 11.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.7 11.1H18.3V13.7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** A glowing day/night disc split down the middle — trading session. */
function SessionIcon({ className, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <circle cx="12" cy="12" r="9.4" fill="currentColor" fillOpacity="0.14" />
      <g filter="url(#ta-lift)">
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth={strokeWidth + 0.3} />
        <path d="M12 5a7 7 0 0 1 0 14Z" fill="currentColor" />
      </g>
      <path d="M12 1.3v2M12 20.7v2M1.3 12h2M20.7 12h2" {...lineBase} strokeWidth={strokeWidth * 0.85} opacity="0.55" />
    </svg>
  );
}

/** A dialed-in bullseye with the dart already stuck in the center — trade setup / model. */
function SetupIcon({ className, style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <circle cx="12" cy="12" r="9.2" fill="currentColor" fillOpacity="0.14" />
      <circle cx="12" cy="12" r="9.2" {...lineBase} strokeWidth={strokeWidth} strokeOpacity="0.7" />
      <circle cx="12" cy="12" r="5.6" fill="currentColor" fillOpacity="0.3" />
      <circle cx="12" cy="12" r="5.6" {...lineBase} strokeWidth={strokeWidth} strokeOpacity="0.85" />
      <g filter="url(#ta-lift)">
        <circle cx="12" cy="12" r="2.1" fill="currentColor" />
        <path d="M19.5 4.5 12 12" stroke="currentColor" strokeWidth={strokeWidth + 0.7} strokeLinecap="round" />
        <path d="M19.5 4.5 16.2 4.9 19.1 7.8Z" fill="currentColor" />
      </g>
    </svg>
  );
}

/** A rising chart channel with a filled area beneath the breakout line — trend. */
function TrendIcon({ className, style, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <path d="M3 20 L3 15 L8 12 L12.5 14.5 L20 5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M3 20 L3 15 L8 12 L12.5 14.5 L20 5 V20 Z" fill="currentColor" fillOpacity="0.2" stroke="none" />
      <g filter="url(#ta-lift)">
        <path d="M3 15 L8 10.5 L12.5 13.2 L18.5 5.5" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 5.5H18.5V9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** A solid summit breaking clean through the prior ceiling, flag planted at the top — all-time high. */
function AthIcon({ className, style, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...svgBase} className={className} style={style}>
      <Defs />
      <path d="M2 9.4h20" {...lineBase} strokeWidth={strokeWidth} strokeOpacity="0.5" strokeDasharray="1.6 2" />
      <g filter="url(#ta-lift)">
        <path d="M2.2 19.5 8.5 8.6 11.5 13.4 14.8 6.8 21.8 19.5Z" fill="currentColor" />
        <path d="M8.5 8.6 11.5 13.4 14.8 6.8" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth={strokeWidth * 0.8} />
      </g>
      <path d="M14.8 6.8V2" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M14.8 2 19 3.6 14.8 5.2Z" fill="currentColor" />
    </svg>
  );
}

interface TradingIconEntry {
  keywords: string[];
  icon: IconComponent;
  /** A deliberate, meaningful color for this concept — not the hash-random tone the rest of the app uses. */
  tone: IconTone;
}

const TRADING_ICONS: TradingIconEntry[] = [
  { keywords: ["direction", "bias"], icon: DirectionIcon, tone: "teal" },
  { keywords: ["displacement"], icon: DisplacementIcon, tone: "rose" },
  { keywords: ["fvg", "fair value gap", "gap"], icon: FvgIcon, tone: "amber" },
  { keywords: ["liquidity", "liq"], icon: LiquidityIcon, tone: "blue" },
  { keywords: ["mss", "structure", "bos", "choch"], icon: MssIcon, tone: "red" },
  { keywords: ["news", "event", "econ"], icon: NewsIcon, tone: "violet" },
  { keywords: ["session"], icon: SessionIcon, tone: "slate" },
  { keywords: ["setup", "model", "strategy"], icon: SetupIcon, tone: "green" },
  { keywords: ["trend"], icon: TrendIcon, tone: "green" },
  { keywords: ["ath", "all time high", "all-time high", "high"], icon: AthIcon, tone: "amber" },
];

export interface TradingIconMatch {
  icon: IconComponent;
  tone: IconTone;
}

/** Looks up a hand-drawn trading-concept icon (plus its own deliberate color) by keyword match against a
 * variable's label/key. Returns null if nothing fits. */
export function getTradingIcon(label: string): TradingIconMatch | null {
  const lower = label.toLowerCase();
  for (const entry of TRADING_ICONS) {
    if (entry.keywords.some((k) => lower.includes(k))) return { icon: entry.icon, tone: entry.tone };
  }
  return null;
}

export {
  DirectionIcon,
  DisplacementIcon,
  FvgIcon,
  LiquidityIcon,
  MssIcon,
  NewsIcon,
  SessionIcon,
  SetupIcon,
  TrendIcon,
  AthIcon,
};
