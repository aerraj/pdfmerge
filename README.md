# pdfmerge

A local Windows PDF workspace with a visual editor, signatures, Office conversion, image compression, OCR and document tools.

**[Download for Windows](https://github.com/aerraj/pdfmerge/releases/latest)** · **[Website](https://pdfmerge-puce.vercel.app/)** · **[Feature details](FEATURES.md)**

## What you can do

- Edit original PDF text and images, add shapes, draw, create links and form fields.
- Draw/import a visual signature or sign cryptographically with a PFX/P12 certificate.
- Convert Word, Excel and PowerPoint both to and from PDF.
- Compress embedded images while retaining selectable text.
- Merge, split, reorder, crop, rotate, resize, add bookmarks and page labels.
- Recognize English/Hindi scans, deskew, repair, redact, compare and flatten.
- Export images, text and PDF/A; protect or unlock with a known password.

Windows 10/11 x64. The full installer includes Python, PDFium, LibreOffice and Tesseract runtimes; no separate installation of those tools is required. The app is unsigned. Files are processed on your computer.

PDF-to-Office layout is reconstructed and may need correction. Redaction and flattening produce image pages. See [FEATURES.md](FEATURES.md) for the scope of every tool.

## Development

Requires Node.js, Rust, Python 3.12+ and [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

    npm ci
    python -m venv .venv
    .venv/bin/python -m pip install -r engine/requirements.txt pytest
    PDFMERGE_PYTHON="$PWD/.venv/bin/python" npm run tauri dev

Use the equivalent Python executable path on Windows. Office-to-PDF and OCR in development need LibreOffice and Tesseract on PATH, or PDFMERGE_RESOURCES pointing to their bundled directories.

    npm run build
    cargo test --manifest-path src-tauri/Cargo.toml
    .venv/bin/python -m pytest engine/test_engine.py -q

The Windows workflow builds the Python engine, downloads pinned upstream runtimes, collects third-party licenses, tests the packaged programs, then creates the NSIS installer. A version tag publishes the installer as a GitHub release. The minimal Vercel landing page lives in website/.
