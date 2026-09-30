# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Sharing the Windows app

Don't send `src-tauri/target/release/mfxjournal.exe` on its own. If it was
built with the GNU Rust toolchain (`x86_64-pc-windows-gnu`), it depends on a
`WebView2Loader.dll` sitting next to it and fails on other PCs with
"WebView2Loader.dll was not found".

Share an installer instead:

- Build locally with `npm run tauri build` and send the setup file from
  `src-tauri/target/release/bundle/nsis/` (or the `.msi` from `bundle/msi/`).
  The installer includes everything the app needs and installs the WebView2
  runtime if it's missing.
- Or run the **Windows build** workflow (Actions tab → Windows build → Run
  workflow) and download the `mfxjournal-windows` artifact. It builds with
  the MSVC toolchain, which links WebView2Loader into the .exe itself.
