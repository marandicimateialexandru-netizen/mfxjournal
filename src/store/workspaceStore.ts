import { create } from "zustand";

interface WorkspaceState {
  workspaceId: string | null;
  workspaceName: string;
  setWorkspace: (id: string, name: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaceId: null,
  workspaceName: "My Stats",
  setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),
}));
