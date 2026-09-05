import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAppBootstrap } from "@/db/useBootstrap";
import { Logo } from "@/components/shared/Logo";
import { AddTradeModal } from "@/features/trades/AddTradeModal";
import { AiTaskAssistant } from "@/features/ai/AiTaskAssistant";

import DashboardPage from "@/app/dashboard/DashboardPage";
import JournalPage from "@/app/journal/JournalPage";
import PlanningPage from "@/app/planning/PlanningPage";
import AdvisorPage from "@/app/advisor/AdvisorPage";
import ReportPage from "@/app/report/ReportPage";
import VariablesPage from "@/app/variables/VariablesPage";
import StrategyPage from "@/app/strategy/StrategyPage";
import SettingsPage from "@/app/settings/SettingsPage";

function SplashScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[var(--color-background)]">
      <Logo size={40} />
      <p className="text-sm text-[var(--color-text-muted)]">
        Know your stake, reduce the mistake, increase your winrate.
      </p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-[var(--color-background)] px-8 text-center">
      <Logo size={36} />
      <p className="text-sm text-[var(--color-danger)]">Failed to start: {message}</p>
    </div>
  );
}

export default function App() {
  const { isReady, error } = useAppBootstrap();

  if (error) return <ErrorScreen message={error} />;
  if (!isReady) return <SplashScreen />;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-text)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/advisor" element={<AdvisorPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/variables" element={<VariablesPage />} />
          <Route path="/strategy" element={<StrategyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <AddTradeModal />
      <AiTaskAssistant />
    </div>
  );
}
