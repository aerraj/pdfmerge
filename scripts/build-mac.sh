#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $(uname -m) == arm64 ]] || { echo 'Build on Apple Silicon'; exit 1; }
PYTHON=${PDFMERGE_PYTHON:-python3}
"$PYTHON" -m pip install -r engine/requirements.txt pyinstaller==6.22.3 pytest==9.1.1
"$PYTHON" -m PyInstaller --noconfirm --clean --onedir --target-arch arm64 --name pdfmerge-engine --distpath src-tauri/resources --workpath build/pyinstaller --specpath build --paths engine --collect-all pypdfium2 --collect-all pypdfium2_raw --collect-all reportlab --collect-all pyhanko --collect-all pyhanko_certvalidator --collect-all cryptography --collect-all cv2 --collect-all pdfminer --collect-all docx --collect-all pptx engine/main.py
ENGINES="$PWD/src-tauri/resources/engines"
mkdir -p "$ENGINES/tesseract/tessdata" build/downloads
DMG=${PDFMERGE_OFFICE_DMG:-$PWD/build/downloads/LibreOffice-arm64.dmg}
if [[ ! -f "$DMG" ]]; then
  curl -fL --retry 3 https://download.documentfoundation.org/libreoffice/stable/26.2.6/mac/aarch64/LibreOffice_26.2.6_MacOS_aarch64.dmg -o "$DMG"
fi
[[ $(shasum -a 256 "$DMG" | cut -d ' ' -f1) == 94bb3248df074c225490a8a6d1d9dc87c7d6783dbb7a8e9f0d0c3d94348552af ]] || { echo 'LibreOffice checksum mismatch'; exit 1; }
if [[ ! -d "$ENGINES/LibreOffice.app" ]]; then
  MOUNT="$PWD/build/office-mount"
  mkdir -p "$MOUNT"
  hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MOUNT"
  trap 'hdiutil detach "$MOUNT" || true' EXIT
  ditto "$MOUNT/LibreOffice.app" "$ENGINES/LibreOffice.app"
  hdiutil detach "$MOUNT"
  trap - EXIT
fi
cp "$(brew --prefix tesseract)/bin/tesseract" "$ENGINES/tesseract/tesseract"
chmod u+w "$ENGINES/tesseract/tesseract"
dylibbundler -od -b -x "$ENGINES/tesseract/tesseract" -d "$ENGINES/tesseract/lib" -p '@executable_path/lib/'
ditto "$(brew --prefix tesseract)/share/tessdata" "$ENGINES/tesseract/tessdata"
for lang in eng hin osd; do
  curl -fsSL --retry 3 "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/$lang.traineddata" -o "$ENGINES/tesseract/tessdata/$lang.traineddata"
done
# Include licenses for the OCR runtime and all bundled Homebrew libraries.
mkdir -p "$ENGINES/tesseract/licenses"
for formula in tesseract $(brew deps tesseract); do
  prefix=$(brew --prefix "$formula")
  mkdir -p "$ENGINES/tesseract/licenses/$formula"
  find "$prefix/" -maxdepth 2 -type f \( -iname '*license*' -o -iname '*copying*' -o -name 'AUTHORS' \) -exec cp {} "$ENGINES/tesseract/licenses/$formula/" \;
  brew info --json=v2 "$formula" > "$ENGINES/tesseract/licenses/$formula/source.json"
done
swiftc scripts/mac-scanner.swift -o "$ENGINES/pdfmerge-scanner" -framework AppKit -framework Quartz -framework ImageCaptureCore
"$PYTHON" scripts/collect-licenses.py
find "$ENGINES/tesseract" -type f \( -name '*.dylib' -o -name tesseract \) -exec codesign --force --sign - {} \;
codesign --force --sign - "$ENGINES/pdfmerge-scanner"
export PDFMERGE_RESOURCES="$ENGINES"
npm test
"$PYTHON" -m pytest engine/test_engine.py engine/test_packaged.py -q
npm run tauri build -- --bundles app
APP="$PWD/src-tauri/target/release/bundle/macos/pdfmerge.app"
# Tauri's resource copier may dereference framework links; restore the vendor bundle.
rm -rf "$APP/Contents/Resources/engines/LibreOffice.app"
ditto "$ENGINES/LibreOffice.app" "$APP/Contents/Resources/engines/LibreOffice.app"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
export PDFMERGE_RESOURCES="$APP/Contents/Resources/engines"
export PDFMERGE_TEST_ENGINE="$APP/Contents/Resources/engine/pdfmerge-engine"
"$PYTHON" -m pytest engine/test_packaged.py -q
mkdir -p build/mac-image
rm -rf build/mac-image/pdfmerge.app
ditto "$APP" build/mac-image/pdfmerge.app
ln -sfn /Applications build/mac-image/Applications
mkdir -p src-tauri/target/release/bundle/dmg
hdiutil create -volname pdfmerge -srcfolder build/mac-image -ov -format UDZO src-tauri/target/release/bundle/dmg/pdfmerge_0.5.1_aarch64.dmg
