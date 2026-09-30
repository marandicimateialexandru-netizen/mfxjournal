import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  KeyRound,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { resetProfilePassword } from "@/db/queries/profiles";
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

/** The sidebar footer's account control — shows who's actually logged in (via `useAuthStore`, set by
 *  the login screen) instead of a hardcoded "Trader" placeholder, and opens a small menu for the two
 *  things a local account needs: changing your password and logging out (back to the profile
 *  picker — see `App.tsx`'s effect that watches `currentProfileId` going null). */
function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const name = useAuthStore((s) => s.currentProfileName) ?? "Trader";
  const profileId = useAuthStore((s) => s.currentProfileId);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function closeAndReset() {
    setOpen(false);
    setResetting(false);
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleReset() {
    if (!profileId) return;
    setError(null);
    if (password.length < 4) return setError("Password must be at least 4 characters.");
    if (password !== confirmPassword) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await resetProfilePassword(profileId, password);
      closeAndReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const trigger = (
    <button className={cn("flex w-full items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-white/[0.04]", collapsed && "justify-center")}>
      <div className="relative shrink-0">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: "linear-gradient(135deg, #a78bfa, #6d28d9)", boxShadow: "0 0 0 1px rgba(139,92,246,0.35), 0 2px 8px -2px rgba(109,40,217,0.6)" }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-success)] shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
      </div>
      {!collapsed && (
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-medium text-[var(--color-text)]">{name}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Local account</div>
        </div>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={(v) => (v ? setOpen(true) : closeAndReset())}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={collapsed ? "right" : "top"} align="start" className="w-64 space-y-3 p-3">
        {!resetting ? (
          <>
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, #a78bfa, #6d28d9)" }}
              >
                {name.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-text)]">{name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">Local account</div>
              </div>
            </div>
            <button
              onClick={() => setResetting(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:bg-[#8b5cf6]/10"
            >
              <KeyRound className="h-4 w-4 text-[#8b5cf6]" /> Reset Password
            </button>
            <button
              onClick={() => {
                closeAndReset();
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
              <KeyRound className="h-4 w-4 text-[#8b5cf6]" /> Reset Password
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[#8b5cf6]"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
              placeholder="Confirm new password"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[#8b5cf6]"
            />
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setResetting(false)}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={handleReset} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
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
        startTransition(() => navigate(item.to));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)]",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      {/* A soft violet glow bleeding down from the top-left, the same "colorful wash instead of a
          flat panel" language the page background already uses (see body's radial-gradient in
          index.css) — the sidebar used to be a completely flat opaque slab that cut that wash off
          at its own edge instead of carrying it through. A plain radial-gradient background (its
          own soft `transparent` falloff does the same visual job a blur would) instead of a
          `blur()` filter — `filter: blur()` forces the browser to rasterize and re-composite a
          dedicated layer on every repaint of anything nearby, and this sits directly above the
          collapse toggle and every nav item, so it was repainting on every hover/click/width
          change and was the actual cause of the reported sidebar lag. */}
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 60%)" }}
      />

      <div className="relative flex items-center justify-between border-b border-[var(--color-border)] px-3 py-4">
        {collapsed ? <LogoMark size={30} /> : <Logo size={30} />}
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

      <div className="relative px-3 pb-3 pt-2" data-tour="new-trade">
        {/* A soft always-on glow behind the button instead of the previous gradient starting from
            `--color-primary` — a dark navy-violet that read as flat/muddy at the gradient's own
            start point, the same "too dark to register" issue fixed elsewhere this session. A
            radial-gradient glow (soft by construction) instead of a blurred solid rectangle — see
            the note on the header's own glow above for why `blur()` was the real perf problem. */}
        <div
          className="pointer-events-none absolute inset-x-1 top-0 h-12 rounded-lg opacity-70"
          style={{ background: "radial-gradient(ellipse 90% 100% at 50% 50%, #8b5cf6, transparent 75%)" }}
        />
        <Button
          className="relative w-full border-none bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] font-semibold shadow-md shadow-violet-950/40 transition-[transform,box-shadow] duration-100 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-950/50 active:scale-[0.97]"
          size={collapsed ? "icon" : "default"}
          onClick={() => openAddTradeModal()}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "New Trade"}
        </Button>
      </div>

      <TodayStat collapsed={collapsed} />

      <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-2 pt-1">
        {/* The active pill used to be `--color-primary` at 15% opacity — a dark navy-violet tint
            that's nearly invisible against the equally dark sidebar (the same trap the calendar's
            "today" ring fell into before). A vivid accent plus a distinct left stripe reads as an
            actual selected state instead of a barely-there tint. */}
        {indicator && (
          <>
            <div
              className="pointer-events-none absolute left-2 right-2 rounded-md transition-[top,height] duration-200 ease-out"
              style={{
                top: indicator.top,
                height: indicator.height,
                background: "color-mix(in srgb, #8b5cf6 14%, transparent)",
                boxShadow: "0 0 0 1px color-mix(in srgb, #8b5cf6 25%, transparent) inset",
              }}
            />
            {!collapsed && (
              <div
                className="pointer-events-none absolute left-2 w-[3px] rounded-full transition-[top,height] duration-200 ease-out"
                style={{ top: indicator.top, height: indicator.height, background: "#8b5cf6", boxShadow: "0 0 8px #8b5cf6" }}
              />
            )}
          </>
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
              // The route change itself is wrapped as a low-priority transition — without this,
              // clicking a nav item while a heavy page (Dashboard, Variables) is about to mount
              // makes the whole click feel like it "hung" for a second, because the synchronous
              // render work for the new page blocks the browser from painting even the sidebar's
              // own click feedback (active pill, pressed state) until it's done. Deferring the
              // page swap lets that feedback paint immediately and the new page fill in right
              // after, instead of both being stuck behind the same blocking render.
              onClick={(e) => {
                e.preventDefault();
                startTransition(() => navigate(item.to));
              }}
              className={({ isActive }) =>
                cn(
                  "group relative z-10 flex items-center gap-3 rounded-md py-2 pl-3 pr-2.5 text-sm transition-colors duration-100 active:scale-[0.98]",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "font-semibold text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-[var(--color-text)]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                      isActive && "text-[#8b5cf6] drop-shadow-[0_0_5px_rgba(139,92,246,0.7)]",
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
        <AccountMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
