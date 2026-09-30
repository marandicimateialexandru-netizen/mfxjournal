import { useId } from "react";

/** The MFX AI Assistant's mark — a friendly robot head (glowing LED eyes, an antenna, a speaker-grille
 *  mouth) over a "data" backdrop: a fine dot-matrix texture plus a glowing sparkline with node points
 *  threading behind it, reading as "this thing is actually looking at data" rather than a generic bot.
 *  A bolder cyan-violet-pink gradient deliberately distinguishes it from the app's own muted
 *  violet-teal `Logo.tsx` mark. Same `useId()`-namespaced-gradient convention so multiple instances
 *  on one page never collide. */
export function AiAssistantLogoMark({ size = 64 }: { size?: number }) {
  const uid = useId();
  const bg = `${uid}-bg`;
  const glow = `${uid}-glow`;
  const eyeGlow = `${uid}-eyeGlow`;
  const antennaGlow = `${uid}-antennaGlow`;
  const dots = `${uid}-dots`;
  const lineGrad = `${uid}-lineGrad`;

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={bg} x1="30" y1="20" x2="482" y2="492" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="52%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="30%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={eyeGlow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={antennaGlow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbcfe8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={lineGrad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <pattern id={dots} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="2" fill="#ffffff" fillOpacity="0.4" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="512" height="512" rx="116" fill={`url(#${bg})`} />
      <rect x="0" y="0" width="512" height="512" rx="116" fill={`url(#${dots})`} opacity="0.22" />
      <rect x="0" y="0" width="512" height="512" rx="116" fill={`url(#${glow})`} />

      {/* A glowing data sparkline threading behind the robot — the "it's actually reading your data" cue */}
      <g opacity="0.6">
        <path
          d="M78,372 L142,338 L198,382 L256,318 L314,356 L370,296 L434,332"
          stroke={`url(#${lineGrad})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="78" cy="372" r="6" fill="#22d3ee" />
        <circle cx="198" cy="382" r="6" fill="#67e8f9" />
        <circle cx="256" cy="318" r="7" fill="#ffffff" />
        <circle cx="370" cy="296" r="6" fill="#f9a8d4" />
        <circle cx="434" cy="332" r="6" fill="#f472b6" />
      </g>

      {/* Scattered data flecks for texture */}
      <g fill="#ffffff">
        <rect x="100" y="150" width="6" height="6" rx="1.5" opacity="0.5" />
        <rect x="404" y="176" width="5" height="5" rx="1.5" opacity="0.4" />
        <rect x="392" y="410" width="6" height="6" rx="1.5" opacity="0.45" />
        <rect x="94" y="404" width="5" height="5" rx="1.5" opacity="0.4" />
      </g>

      {/* Antenna */}
      <line x1="256" y1="98" x2="256" y2="126" stroke="#fbcfe8" strokeOpacity="0.9" strokeWidth="8" strokeLinecap="round" />
      <circle cx="256" cy="90" r="24" fill={`url(#${antennaGlow})`} />
      <circle cx="256" cy="90" r="11" fill="#fbcfe8" />

      {/* Side ears */}
      <rect x="128" y="192" width="22" height="58" rx="11" fill="#0f172a" fillOpacity="0.8" stroke="#e0e7ff" strokeOpacity="0.32" strokeWidth="3" />
      <rect x="362" y="192" width="22" height="58" rx="11" fill="#0f172a" fillOpacity="0.8" stroke="#e0e7ff" strokeOpacity="0.32" strokeWidth="3" />

      {/* Head shell */}
      <rect x="148" y="130" width="216" height="182" rx="48" fill="#0f172a" fillOpacity="0.84" stroke="#e0e7ff" strokeOpacity="0.35" strokeWidth="4" />

      {/* Eyes */}
      <circle cx="207" cy="214" r="32" fill={`url(#${eyeGlow})`} />
      <circle cx="207" cy="214" r="17" fill="#22d3ee" />
      <circle cx="305" cy="214" r="32" fill={`url(#${eyeGlow})`} />
      <circle cx="305" cy="214" r="17" fill="#22d3ee" />

      {/* Speaker-grille mouth */}
      <line x1="196" y1="264" x2="216" y2="264" stroke="#e0e7ff" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
      <line x1="230" y1="264" x2="250" y2="264" stroke="#e0e7ff" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
      <line x1="264" y1="264" x2="284" y2="264" stroke="#e0e7ff" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
      <line x1="298" y1="264" x2="318" y2="264" stroke="#e0e7ff" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
