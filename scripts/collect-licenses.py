from pathlib import Path
import importlib.metadata as metadata
import shutil
root=Path("src-tauri/resources/pdfmerge-engine/THIRD_PARTY")
root.mkdir(parents=True,exist_ok=True)
for dist in metadata.distributions():
    name=dist.metadata.get("Name","unknown")
    dest=root/name
    dest.mkdir(exist_ok=True)
    (dest/"METADATA.txt").write_text(dist.read_text("METADATA") or dist.read_text("PKG-INFO") or name,encoding="utf-8")
    for item in dist.files or []:
        if any(word in str(item).lower() for word in ("license","copying","notice")):
            source=Path(dist.locate_file(item))
            if source.is_file():
                target=dest/str(item).replace("/","_").replace("\\","_")
                shutil.copyfile(source,target)
(root/"README.txt").write_text("pdfmerge uses the following unmodified open source components. License texts are included here and within bundled LibreOffice and Tesseract directories. LibreOffice source: https://download.documentfoundation.org/libreoffice/src/26.2.6/ . Tesseract Windows source: https://github.com/tesseract-ocr/tesseract/tree/5.5.0 . Mac Tesseract source and version are recorded in engines/tesseract/licenses/tesseract/source.json . PDFium source and licenses: https://github.com/pypdfium2-team/pypdfium2 . Python component sources and versions are identified in each package metadata file.",encoding="utf-8")
