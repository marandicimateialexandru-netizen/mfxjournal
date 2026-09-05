import { useEffect, useState } from "react";
import { ensureDefaultWorkspace, listWorkspaces } from "./queries/workspaces";
import { getSettings } from "./queries/settings";
import { seedIfEmpty } from "./seed";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUiStore } from "@/store/uiStore";
import { applyTheme } from "@/features/theming/applyTheme";
import { getPersistedWorkspaceId, setPersistedWorkspaceId } from "@/lib/activeWorkspace";

export function useAppBootstrap() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const setCalcMode = useUiStore((s) => s.setCalcMode);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await listWorkspaces();
        const persistedId = getPersistedWorkspaceId();
        const persisted = persistedId ? all.find((w) => w.id === persistedId) : undefined;
        const workspace = persisted ?? (await ensureDefaultWorkspace());
        setPersistedWorkspaceId(workspace.id);
        await seedIfEmpty(workspace.id);
        const settings = await getSettings(workspace.id);
        if (cancelled) return;
        setWorkspace(workspace.id, workspace.name);
        setCalcMode(settings.calc_mode);
        applyTheme(settings.theme, settings.custom_colors ? JSON.parse(settings.custom_colors) : null);
        setIsReady(true);
      } catch (err) {
        console.error("Bootstrap failed", err);
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isReady, error };
}
