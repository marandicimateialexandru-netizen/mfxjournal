import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums",
  {
    variants: {
      variant: {
        default: "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]",
        win: "border-transparent bg-[var(--color-success)]/15 text-[var(--color-success)]",
        loss: "border-transparent bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
        be: "border-transparent bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
        outline: "text-[var(--color-text)] border-[var(--color-border)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
