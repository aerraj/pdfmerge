# pdfmerge

A small Windows desktop app for combining PDF files. Add PDFs, arrange their order, and save one merged document. Files are processed locally; the app does not upload them.

## Download for Windows

**[Download the latest Windows installer](https://github.com/aerraj/pdfmerge/releases/latest)**

Open the latest release and download the `.exe` installer under **Assets**. Windows 10 or 11 (x64) is required. The installer is currently unsigned, so Windows SmartScreen may show a warning.

## Use

1. Select **Add PDFs** and choose two or more files.
2. Use the arrow buttons to set their order.
3. Select **Merge PDFs**, choose a new output filename, and save.

Password protected PDFs are not supported. Existing output files are never overwritten. PDF pages and their inherited page properties are retained; interactive form fields, document bookmarks, and digital signatures are not guaranteed to survive a merge.

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
