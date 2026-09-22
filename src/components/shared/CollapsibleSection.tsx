import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { IconBadge, type IconTone } from "@/components/shared/IconBadge";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  subtitle,
  icon: Icon,
  tone = "violet",
  headerRight,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: IconTone;
  headerRight?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <div className="flex w-full items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {Icon && <IconBadge icon={Icon} tone={tone} size={30} className="shrink-0" />}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-[var(--color-text)]">{title}</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform", !open && "-rotate-90")}
              />
            </span>
            {subtitle && <span className="block truncate text-xs text-[var(--color-text-muted)]">{subtitle}</span>}
          </span>
        </button>
        {headerRight && <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{headerRight}</div>}
      </div>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
