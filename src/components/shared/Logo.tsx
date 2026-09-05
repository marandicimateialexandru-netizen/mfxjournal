export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 2 L28 7 V15 C28 22.5 23 27.5 16 30 C9 27.5 4 22.5 4 15 V7 L16 2 Z"
        fill="var(--color-primary)"
        stroke="var(--color-border)"
        strokeWidth="1"
      />
      <path
        d="M9 18 L13 13 L17 16 L23 9"
        stroke="var(--color-success)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M19 9 H23 V13" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
