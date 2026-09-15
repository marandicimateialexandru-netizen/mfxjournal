import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES, EMOJI_CATEGORY_NAMES } from "@/lib/emojiCategories";

/**
 * Single shared emoji picker used everywhere an icon can be assigned: custom results,
 * variable values, and any future icon slot. Keeps icon selection consistent across the app.
 *
 * Renders its panel inline (no Radix Portal) so it also works correctly when nested inside a
 * Dialog — a portaled Popover's dismissable layer fights the Dialog's own outside-click handling
 * and closes itself the instant it opens.
 */
export function IconPicker({
  value,
  onChange,
  children,
}: {
  value?: string | null;
  onChange: (icon: string | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{children}</div>
      {open && (
        <div className="absolute left-1/2 top-full z-[60] mt-2 w-80 -translate-x-1/2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-surface-foreground)] shadow-lg">
          <Tabs defaultValue={EMOJI_CATEGORY_NAMES[0]}>
            <ScrollArea className="w-full">
              <TabsList className="flex h-auto w-max flex-nowrap gap-0.5 p-1">
                {EMOJI_CATEGORY_NAMES.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="shrink-0 px-2 py-1 text-[11px]">
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
            {EMOJI_CATEGORY_NAMES.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-2">
                <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
                  {EMOJI_CATEGORIES[cat].map((emoji, i) => (
                    <button
                      key={`${emoji}-${i}`}
                      type="button"
                      onClick={() => {
                        onChange(emoji);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-[var(--color-background)]",
                        value === emoji && "bg-[var(--color-primary)]/20 ring-1 ring-[var(--color-primary)]",
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-2 w-full text-center text-xs text-[var(--color-danger)] hover:underline"
            >
              Remove icon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Clickable swatch trigger for the IconPicker — shows the current icon or an empty-state hint. */
export function IconPickerSwatch({
  icon,
  size = 40,
  className,
  hint = "Click to pick an icon",
}: {
  icon?: string | null;
  size?: number;
  className?: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {icon ? (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{icon}</span>
      ) : (
        <span className="px-1 text-center text-[9px] leading-tight">{hint}</span>
      )}
    </button>
  );
}
