import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: false },
  },
});

// StrictMode intentionally double-renders every component and double-invokes every effect as a
// dev-only diagnostic — real cost, zero benefit to how the app actually runs, and this app is only
// ever exercised via `tauri dev`, never a separate "production" run someone else might profile.
// With this many concurrent on-mount animations, that tax was compounding on top of them.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={200}>
      <HashRouter>
        <App />
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>,
);
