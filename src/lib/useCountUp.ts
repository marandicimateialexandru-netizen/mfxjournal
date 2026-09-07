import { useEffect, useRef, useState } from "react";

/** Smooth ease-in-out: gentle acceleration, gentle deceleration — reads as more
 *  deliberate/premium than a pure ease-out, which starts at full speed and can
 *  feel abrupt. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Animates a number from 0 up to `target` on mount and whenever `target` changes.
 *  `delay` (ms) staggers the start — running several of these with a small increasing
 *  delay per tile reads as choreographed rather than everything jumping at once. */
export function useCountUp(target: number, duration = 1100, delay = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(target);
      return;
    }
    setValue(0);

    function animate() {
      const start = performance.now();
      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        const eased = easeInOutCubic(progress);
        setValue(target * eased);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setValue(target);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    timeoutRef.current = setTimeout(animate, delay);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    };
  }, [target, duration, delay]);

  return value;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Animates 0 -> 1 on mount and whenever `trigger` changes, using an ease-out curve (fast start,
 *  gentle settle — reads better than ease-in-out for a "draw this in" reveal, which felt sluggish
 *  at the start with a slow-starting ease). Driven entirely by React state via requestAnimationFrame
 *  rather than a CSS animation, so it's guaranteed to actually replay every time `trigger` changes —
 *  a CSS keyframe on a class can silently fail to restart if the element doesn't remount. */
export function useRevealProgress(trigger: unknown, duration = 900): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setProgress(easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, duration]);

  return progress;
}
