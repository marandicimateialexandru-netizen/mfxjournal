import { useId } from "react";

/** The app's mark — an open journal with a candlestick chart drawn across its pages, ascending
 *  into a winning green candle. Same source design used to generate the actual app/taskbar icon
 *  (see `design/logo-mark.svg`), so the icon in the OS taskbar and the one rendered here in the UI
 *  are the same logo, not two different ones. Uses `useId` for the gradient/glow defs so multiple
 *  instances on one page (sidebar + splash, say) never collide over a shared `id="bg"`. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const uid = useId();
  const bg = `${uid}-bg`;
  const pageL = `${uid}-pageL`;
  const pageR = `${uid}-pageR`;
  const win = `${uid}-win`;
  const glow = `${uid}-glow`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={bg} x1="40" y1="30" x2="472" y2="482" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="52%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
        <linearGradient id={pageL} x1="130" y1="130" x2="256" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.97" />
          <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={pageR} x1="382" y1="130" x2="256" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.97" />
          <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={win} x1="304" y1="185" x2="304" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="512" height="512" rx="116" fill={`url(#${bg})`} />
      <rect x="0" y="0" width="512" height="512" rx="116" fill={`url(#${glow})`} />

      {/* Open journal: two pages fanning from a center spine */}
      <path
        d="M256,168 C 214,142 168,130 132,127 C 120,126 111,135 111,147 L111,338 C 111,349 120,357 132,358 C 168,361 214,372 256,396 Z"
        fill={`url(#${pageL})`}
      />
      <path
        d="M256,168 C 298,142 344,130 380,127 C 392,126 401,135 401,147 L401,338 C 401,349 392,357 380,358 C 344,361 298,372 256,396 Z"
        fill={`url(#${pageR})`}
      />

      <path d="M256,168 L256,396" stroke="#4c1d95" strokeOpacity="0.28" strokeWidth="7" strokeLinecap="round" />

      {/* Journal rule lines */}
      <path d="M138,180 L214,196" stroke="#c4b5fd" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round" />
      <path d="M136,210 L212,224" stroke="#c4b5fd" strokeOpacity="0.7" strokeWidth="6" strokeLinecap="round" />
      <path d="M298,196 L374,180" stroke="#c4b5fd" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round" />
      <path d="M300,224 L376,210" stroke="#c4b5fd" strokeOpacity="0.7" strokeWidth="6" strokeLinecap="round" />

      {/* Candlesticks ascending across the open pages */}
      <line x1="196" y1="248" x2="196" y2="322" stroke="#7c3aed" strokeOpacity="0.55" strokeWidth="9" strokeLinecap="round" />
      <rect x="182" y="264" width="28" height="46" rx="6" fill="#7c3aed" fillOpacity="0.55" />

      <line x1="256" y1="210" x2="256" y2="330" stroke="#6d28d9" strokeWidth="10" strokeLinecap="round" />
      <rect x="240" y="232" width="32" height="76" rx="7" fill="#6d28d9" />

      <line x1="316" y1="168" x2="316" y2="316" stroke="#34d399" strokeWidth="11" strokeLinecap="round" />
      <rect x="298" y="185" width="36" height="115" rx="8" fill={`url(#${win})`} />
    </svg>
  );
}

export function Logo({ size = 28, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={size} />
      {showText && (
        <span className="text-base font-semibold tracking-tight text-[var(--color-text)]">
          MFX<span className="text-[var(--color-text-muted)] font-normal">Journal</span>
        </span>
      )}
    </div>
  );
}
