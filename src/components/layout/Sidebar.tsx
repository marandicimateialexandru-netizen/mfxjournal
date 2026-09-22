import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { startOfDay, endOfDay } from "date-fns";
import {
  LayoutGrid,
  BookOpen,
  CalendarDays,
  Sparkles,
  FileText,
  Tags,
  Layers,
  Settings as SettingsIcon,
  Plus,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useUiStore } from "@/store/uiStore";
import { WorkspaceSwitcher } from "@/features/workspace/WorkspaceSwitcher";
import { useTrades } from "@/features/trades/useTrades";
import { useCustomResults } from "@/features/variables/useAuxLists";
import { useSettings } from "@/features/settings/useSettings";
import { computeStats } from "@/features/stats/computeStats";
import { formatR } from "@/lib/format";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/planning", label: "Planning", icon: CalendarDays },
  { to: "/advisor", label: "AI Advisor", icon: Sparkles },
  { to: "/report", label: "Report", icon: FileText },
  { to: "/variables", label: "Variables", icon: Tags },
  { to: "/strategy", label: "Strategy", icon: Layers },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/** A live glance at today's performance, pulled straight from real trade data — not just navigation chrome. */
function TodayStat({ collapsed }: { collapsed: boolean }) {
  const { data: trades = [] } = useTrades();
  const { data: customResults = [] } = useCustomResults();
  const { data: settings } = useSettings();

  const today = useMemo(() => {
    const now = new Date();
    return computeStats(trades, {
      dateRange: { start: startOfDay(now), end: endOfDay(now) },
      customResults,
    });
  }, [trades, customResults]);

  if (today.totalTrades === 0) return null;

  const positive = today.totalR >= 0;
  const toneClass = positive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]";
  const value = formatR(today.totalR, settings?.calc_mode ?? "r", settings?.risk_per_r_percent, settings?.risk_per_r_dollar, {
    showSign: true,
  });
  const summary = `Today: ${value} · ${today.winRatePct.toFixed(0)}% WR · ${today.totalTrades} trade${today.totalTrades === 1 ? "" : "s"}`;

  if (collapsed) {
    return (
      <div className="px-3 pb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background)]">
              <span className="relative flex h-2 w-2">
                <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", positive ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")} />
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", positive ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")} />
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{summary}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", positive ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")} />
            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", positive ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]")} />
          </span>
          Today
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {today.totalTrades} trade{today.totalTrades === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("text-lg font-bold tabular-nums", toneClass)}>{value}</span>
        <span className="text-xs text-[var(--color-text-muted)]">{today.winRatePct.toFixed(0)}% WR</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openAddTradeModal = useUiStore((s) => s.openAddTradeModal);
  const location = useLocation();
  const navigate = useNavigate();

  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const active = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to));
    const el = active ? itemRefs.current[active.to] : null;
    if (el) setIndicator({ top: el.offsetTop, height: el.offsetHeight });
  }, [location.pathname, collapsed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const idx = Number(e.key) - 1;
      const item = NAV_ITEMS[idx];
      if (item) {
        e.preventDefault();
        navigate(item.to);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-150",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-4">
        {collapsed ? <LogoMark size={28} /> : <Logo size={28} />}
        <button
          onClick={toggleSidebar}
          className="shrink-0 rounded-md p-1 text-[var(--color-text-muted)] transition-colors duration-100 hover:bg-[var(--color-background)] hover:text-[var(--color-text)] active:scale-90"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="space-y-2 px-3 pb-1 pt-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <div className="px-3 pb-3 pt-2" data-tour="new-trade">
        <Button
          className="w-full border-none bg-gradient-to-r from-[var(--color-primary)] to-violet-600 font-semibold shadow-md shadow-violet-950/40 transition-[transform,box-shadow] duration-100 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-950/50 active:scale-[0.97]"
          size={collapsed ? "icon" : "default"}
          onClick={() => openAddTradeModal()}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "New Trade"}
        </Button>
      </div>

      <TodayStat collapsed={collapsed} />

      <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-2 pt-1">
        {indicator && (
          <div
            className="pointer-events-none absolute left-2 right-2 rounded-md bg-[var(--color-primary)]/15 transition-[top,height] duration-200 ease-out"
            style={{ top: indicator.top, height: indicator.height }}
          />
        )}

        {NAV_ITEMS.map((item) => {
          const link = (
            <NavLink
              key={item.to}
              ref={(el) => {
                itemRefs.current[item.to] = el;
              }}
              to={item.to}
              data-tour={`nav-${item.to.slice(1)}`}
              className={({ isActive }) =>
                cn(
                  "group relative z-10 flex items-center gap-3 rounded-md py-2 pl-3 pr-2.5 text-sm transition-colors duration-100 active:scale-[0.98]",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "font-semibold text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                      isActive && "text-[var(--color-primary)]",
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );

          if (!collapsed) return link;

          return (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="relative shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-600 text-xs font-bold text-white shadow-sm">
              T
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-success)]" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--color-text)]">Trader</div>
              <div className="text-xs text-[var(--color-text-muted)]">Local account</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
