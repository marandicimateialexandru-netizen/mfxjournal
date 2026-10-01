// Builds the latest.json manifest the auto-updater checks on every launch. Run this after
// `npm run tauri build` has produced signed installers (createUpdaterArtifacts: true in
// tauri.conf.json + TAURI_SIGNING_PRIVATE_KEY[_PASSWORD] env vars during that build create the
// matching .sig files this script reads). Usage:
//   node scripts/make-latest-json.mjs [releaseNotes]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const conf = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf-8"));
const version = conf.version;
const repo = "marandicimateialexandru-netizen/mfxjournal";
const notes = process.argv[2] ?? `MFX Journal v${version}`;

const nsisExe = `MFX Journal_${version}_x64-setup.exe`;
const nsisSigPath = join(root, `src-tauri/target/release/bundle/nsis/${nsisExe}.sig`);

if (!existsSync(nsisSigPath)) {
  console.error(`Missing ${nsisSigPath}`);
  console.error("Build with TAURI_SIGNING_PRIVATE_KEY (and _PASSWORD if your key has one) set, so the bundler signs the installer.");
  process.exit(1);
}

const signature = readFileSync(nsisSigPath, "utf-8").trim();

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(nsisExe)}`,
    },
  },
};

const outPath = join(root, "src-tauri/target/release/bundle/nsis/latest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`\nUpload to the GitHub Release tagged v${version}:`);
console.log(`  - ${nsisExe}`);
console.log(`  - latest.json`);
