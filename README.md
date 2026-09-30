# pdfmerge

A Windows desktop app for local PDF work. Version 0.2.0 includes 15 tools for organizing, editing, securing, and extracting content from PDFs. Files stay on your computer.

**Website:** [pdfmerge-puce.vercel.app](https://pdfmerge-puce.vercel.app/) · The landing page source is in [`website/`](website/).

## Download for Windows

**[Download the Windows installer](https://github.com/aerraj/pdfmerge/releases/download/v0.2.0/pdfmerge_0.2.0_x64-setup.exe)**

Windows 10 or 11 (x64) is required. The installer is unsigned, so Windows SmartScreen may show a warning.

## Tools in v0.2.0

- Organize: merge, split into individual pages, extract pages, remove pages, reorder pages, rotate pages.
- Edit: crop visible page area, add page numbers, add a text watermark, remove annotations, edit metadata.
- Optimize: lossless PDF repacking. This may leave the file size unchanged or increase it.
- Security: protect with a PDF password (AES-128), unlock a PDF when you know its password.
- Convert: extract selectable text to a `.txt` file.

The app creates a new output file for every operation and does not overwrite existing files. Passwords are not stored. The current tools do not include OCR, image compression, Office conversion, a full PDF editor, form filling, or digital signing. See [FEATURES.md](FEATURES.md) for the feature comparison and remaining work.

## Develop

Requires Node.js, Rust, and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run tauri dev
```

Checks:

```sh
npm run build
cd src-tauri && cargo test
```

Pushing a `v*` tag runs the Windows release workflow and attaches the NSIS installer to a GitHub Release.
