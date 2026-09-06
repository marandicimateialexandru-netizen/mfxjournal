import { newId } from "./id";

/** Copies user-picked screenshot files into the app's own data directory (`$APPDATA/screenshots/`)
 *  so they survive if the original is moved/deleted, and so the restricted asset-protocol scope
 *  (which only allows serving files from that folder) can safely render them later. */
export async function copyScreenshotsToAppData(sourcePaths: string[]): Promise<string[]> {
  const { copyFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");
  const { appDataDir, join } = await import("@tauri-apps/api/path");

  const dir = await appDataDir();
  const screenshotsDir = await join(dir, "screenshots");
  if (!(await exists(screenshotsDir))) {
    await mkdir(screenshotsDir, { recursive: true });
  }

  const copied: string[] = [];
  for (const src of sourcePaths) {
    const ext = src.split(".").pop()?.toLowerCase() || "png";
    const dest = await join(screenshotsDir, `${newId()}.${ext}`);
    await copyFile(src, dest);
    copied.push(dest);
  }
  return copied;
}
