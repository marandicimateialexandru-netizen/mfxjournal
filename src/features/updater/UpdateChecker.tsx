import { useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type Phase = "idle" | "downloading" | "installing" | "error";

/** Silently checks GitHub Releases for a newer signed build a few seconds after launch, and offers
 *  to download+install it in place if one exists — the whole point being nobody ever has to manually
 *  download and run a new setup.exe again. Fails silent on any network/dev-environment error (e.g.
 *  running outside a packaged Tauri build) since an update check is never critical to the app working. */
export function UpdateChecker() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const checkedOnce = useRef(false);

  useEffect(() => {
    if (checkedOnce.current) return;
    checkedOnce.current = true;
    const t = setTimeout(async () => {
      try {
        const result = await check();
        if (result?.available) setUpdate(result);
      } catch (err) {
        console.error("Update check failed:", err);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  async function handleInstall() {
    if (!update) return;
    setPhase("downloading");
    try {
      let total = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setProgress(total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0);
            break;
          case "Finished":
            setPhase("installing");
            break;
        }
      });
      await relaunch();
    } catch (err) {
      console.error("Update install failed:", err);
      setPhase("error");
    }
  }

  if (!update) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && phase === "idle" && setUpdate(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-[#8b5cf6]" />
            Update available — v{update.version}
          </DialogTitle>
          <DialogDescription>
            {update.body?.trim() || "A new version of MFX Journal is ready to install."}
          </DialogDescription>
        </DialogHeader>

        {phase === "downloading" && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[#8b5cf6] transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">Downloading… {progress}%</p>
          </div>
        )}
        {phase === "installing" && (
          <p className="text-xs text-[var(--color-text-muted)]">Installing — the app will restart automatically.</p>
        )}
        {phase === "error" && (
          <p className="text-xs text-[var(--color-danger)]">
            Couldn't install the update automatically. You can download it manually from GitHub.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setUpdate(null)} disabled={phase === "downloading" || phase === "installing"}>
            Later
          </Button>
          <Button onClick={handleInstall} disabled={phase === "downloading" || phase === "installing"}>
            {phase === "downloading" || phase === "installing" ? "Working…" : "Update Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
