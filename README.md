# pdfmerge

A local Windows and Apple Silicon Mac PDF workspace with a visual editor, signatures, Office conversion, image compression, OCR and document tools.

**[Download for Windows or Mac](https://pdfmerge-puce.vercel.app/)** · **[Feature details](FEATURES.md)**

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
    npm test
    cargo test --manifest-path src-tauri/Cargo.toml
    .venv/bin/python -m pytest engine/test_engine.py -q

The Windows workflow builds the Python engine, downloads pinned upstream runtimes, collects third-party licenses, tests the packaged programs, then creates the NSIS installer. A version tag publishes the installer as a GitHub release. The minimal Vercel landing page lives in website/.

## Apple Silicon Mac edition (0.4.1)

Download `pdfmerge_0.4.1_aarch64.dmg` from the [Mac release](https://github.com/aerraj/pdfmerge/releases/tag/v0.4.1). Open the disk image and drag pdfmerge into Applications. This build requires **Apple Silicon and macOS 26.6.2 or later**; it does not run on Intel Macs. The Windows download is available from the same landing page.

The Mac edition uses the same black/green Roboto interface and PDF tools, with bundled native PDF, LibreOffice and Tesseract engines. Scanner capture uses Apple's Image Capture scanner controls instead of Windows WIA. Scanner hardware integration requires a compatible connected device and was not hardware-tested.

The app is ad-hoc signed, **not Apple-notarized**. macOS may require opening System Settings → Privacy & Security → Open Anyway after an attempted first launch. This does not require disabling Gatekeeper globally.

### Rebuild on Apple Silicon

Use macOS 26.6.2+, Node, Rust, Python 3.14 and Xcode command line tools. Install the build-time tools with `brew install tesseract dylibbundler`; users of the packaged app do not need Homebrew. Create a Python virtual environment and set `PDFMERGE_PYTHON` to its Python executable, then run `npm ci` and `./scripts/build-mac.sh`. The script verifies LibreOffice's download checksum, copies OCR dependencies and licenses, builds the native scanner helper, runs source and packaged-engine tests, builds the app, checks the installed bundle, and creates the DMG. The output is `src-tauri/target/release/bundle/dmg/pdfmerge_0.4.1_aarch64.dmg`.

The editor has grouped controls for text, forms, links, annotations, shapes and signatures. Uploaded signatures can keep their background or remove a light paper background. After you place one signature, the editor selects it and returns to Select mode. Drag it to move it; use the corner handles to resize proportionally, side handles to stretch, or the size buttons and width and height fields. Delete it with the red on-page button, the inspector, or the Delete key. Choose Add signature again to place another.
