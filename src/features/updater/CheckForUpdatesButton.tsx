import { useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Status = "idle" | "checking" | "up-to-date" | "error";

/** A manual, on-demand version of what `UpdateChecker` already does automatically on launch — for
 *  someone who doesn't want to wait for the next restart to see if a new build is out. */
export function CheckForUpdatesButton() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleClick() {
    setStatus("checking");
    try {
      const result = await check();
      setStatus(result?.available ? "idle" : "up-to-date");
      if (result?.available) window.location.reload();
    } catch (err) {
      console.error("Manual update check failed:", err);
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={handleClick} disabled={status === "checking"}>
        <RefreshCw className={`h-4 w-4 ${status === "checking" ? "animate-spin" : ""}`} /> Check for Updates
      </Button>
      {status === "up-to-date" && <span className="text-xs text-[var(--color-text-muted)]">You're on the latest version.</span>}
      {status === "error" && <span className="text-xs text-[var(--color-danger)]">Couldn't check right now.</span>}
    </div>
  );
}
