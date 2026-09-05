import { NavLink } from "react-router-dom";
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
import { useUiStore } from "@/store/uiStore";
import { WorkspaceSwitcher } from "@/features/workspace/WorkspaceSwitcher";

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

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openAddTradeModal = useUiStore((s) => s.openAddTradeModal);

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {collapsed ? <LogoMark size={26} /> : <Logo size={26} />}
        <button
          onClick={toggleSidebar}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="px-3 pb-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <div className="px-3 pb-3" data-tour="new-trade">
        <Button className="w-full" size={collapsed ? "icon" : "default"} onClick={() => openAddTradeModal()}>
          <Plus className="h-4 w-4" />
          {!collapsed && "New Trade"}
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-tour={`nav-${item.to.slice(1)}`}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-[var(--color-background)] text-[var(--color-text)] font-medium"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)]",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-background)] text-xs font-medium">
            T
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm text-[var(--color-text)]">Trader</div>
              <div className="text-xs text-[var(--color-text-muted)]">Local account</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
