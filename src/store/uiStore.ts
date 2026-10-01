import { create } from "zustand";
import type { CalcMode } from "@/db/types";

export type DateRangePreset =
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom"
  | "all";

export interface DateRange {
  preset: DateRangePreset;
  start: Date | null;
  end: Date | null;
}

interface UiState {
  calcMode: CalcMode;
  setCalcMode: (mode: CalcMode) => void;

  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;

  strategyId: string | null;
  setStrategyId: (id: string | null) => void;

  symbolFilter: string | null;
  setSymbolFilter: (symbol: string | null) => void;

  beInWinRate: boolean;
  toggleBeInWinRate: () => void;
  hideEmpty: boolean;
  toggleHideEmpty: () => void;
  hideBeRateColor: boolean;
  toggleHideBeRateColor: () => void;
  showLossRateColor: boolean;
  toggleShowLossRateColor: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  addTradeModalOpen: boolean;
  editingTradeId: string | null;
  draftTrade: Record<string, unknown> | null;
  openAddTradeModal: (tradeId?: string) => void;
  openAddTradeModalWithDraft: (draft: Record<string, unknown>) => void;
  closeAddTradeModal: () => void;

  aiTaskAssistantOpen: boolean;
  toggleAiTaskAssistant: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  calcMode: "r",
  setCalcMode: (mode) => set({ calcMode: mode }),

  dateRange: { preset: "all", start: null, end: null },
  setDateRange: (range) => set({ dateRange: range }),

  strategyId: null,
  setStrategyId: (id) => set({ strategyId: id }),

  symbolFilter: null,
  setSymbolFilter: (symbol) => set({ symbolFilter: symbol }),

  beInWinRate: false,
  toggleBeInWinRate: () => set((s) => ({ beInWinRate: !s.beInWinRate })),
  hideEmpty: true,
  toggleHideEmpty: () => set((s) => ({ hideEmpty: !s.hideEmpty })),
  hideBeRateColor: false,
  toggleHideBeRateColor: () => set((s) => ({ hideBeRateColor: !s.hideBeRateColor })),
  showLossRateColor: false,
  toggleShowLossRateColor: () => set((s) => ({ showLossRateColor: !s.showLossRateColor })),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  addTradeModalOpen: false,
  editingTradeId: null,
  draftTrade: null,
  openAddTradeModal: (tradeId) => set({ addTradeModalOpen: true, editingTradeId: tradeId ?? null, draftTrade: null }),
  openAddTradeModalWithDraft: (draft) => set({ addTradeModalOpen: true, editingTradeId: null, draftTrade: draft }),
  closeAddTradeModal: () => set({ addTradeModalOpen: false, editingTradeId: null, draftTrade: null }),

  aiTaskAssistantOpen: false,
  toggleAiTaskAssistant: () => set((s) => ({ aiTaskAssistantOpen: !s.aiTaskAssistantOpen })),
}));
