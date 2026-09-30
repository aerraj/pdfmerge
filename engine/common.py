"""Local PDF engine. Coordinates exposed to the UI use a top-left origin in points."""
import base64
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from PIL import Image
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject
import pypdfium2 as pdfium
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


def reader(path, password=""):
    r = PdfReader(path, strict=False)
    if r.is_encrypted and not r.decrypt(password):
        raise ValueError("This PDF needs its password. Unlock it first.")
    if not r.pages:
        raise ValueError("The PDF contains no pages.")
    return r


def normalize(path):
    r = reader(path)
    w = PdfWriter(clone_from=r)
    for p in w.pages:
        p.transfer_rotation_to_content()
        # Make the visible crop area the canonical editor coordinate space.
        box = p.cropbox
        x, y, width, height = float(box.left), float(box.bottom), float(box.width), float(box.height)
        p.add_transformation(Transformation().translate(-x, -y))
        p.mediabox = RectangleObject([0, 0, width, height])
        p.cropbox = RectangleObject([0, 0, width, height])
    out = io.BytesIO()
    w.write(out)
    return out.getvalue()


def pdf_bytes(w):
    b = io.BytesIO()
    w.write(b)
    return b.getvalue()


def atomic_bytes(path, data):
    path = Path(path)
    if path.exists():
        raise ValueError("The output already exists. Choose a new filename.")
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents races and never replaces an input.
    try:
        with path.open("xb") as out:
            out.write(data)
    except Exception:
        if path.exists() and path.stat().st_size == 0:
            path.unlink()
        raise
    return str(path)


def write_pdf(w, path):
    return atomic_bytes(path, pdf_bytes(w))


def ranges(spec, count):
    if not spec.strip():
        return list(range(count))
    result = []
    for part in spec.split(","):
        values = part.strip().split("-")
        start = int(values[0])
        end = int(values[-1])
        if len(values) > 2 or not 1 <= start <= end <= count:
            raise ValueError(f"Pages must be within 1–{count}.")
        result.extend(range(start - 1, end))
    return list(dict.fromkeys(result))


def subset(r, indices):
    w = PdfWriter()
    for i in indices:
        w.add_page(r.pages[i])
    return w


def render(data, index, dpi=110):
    with pdfium.PdfDocument(data) as doc:
        page = doc[index]
        bitmap = page.render(scale=dpi / 72, may_draw_forms=True)
        image = bitmap.to_pil().copy()
        bitmap.close()
        page.close()
    return image


def image_pdf(images, sizes=None, jpeg_quality=85):
    result = io.BytesIO()
    c = canvas.Canvas(result)
    for i, image in enumerate(images):
        image = image.convert("RGB")
        size = sizes[i] if sizes else (image.width * .75, image.height * .75)
        c.setPageSize(size)
        blob = io.BytesIO()
        image.save(blob, "JPEG", quality=jpeg_quality, optimize=True)
        c.drawImage(ImageReader(blob), 0, 0, *size)
        c.showPage()
    c.save()
    return result.getvalue()


def overlay(page, draw):
    b = io.BytesIO()
    c = canvas.Canvas(b, pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
    draw(c, float(page.mediabox.width), float(page.mediabox.height))
    c.showPage()
    c.save()
    page.merge_page(PdfReader(b).pages[0])


def image_data(value):
    if value.startswith("data:"):
        value = value.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(value)))


def resource_root():
    return Path(os.environ.get("PDFMERGE_RESOURCES", Path(__file__).resolve().parent))


def find_program(name):
    root = resource_root()
    candidates = {
        "office": [root / "libreoffice/program/soffice.com", root / "libreoffice/program/soffice.exe",
                   Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")],
        "ocr": [root / "tesseract/tesseract.exe"],
    }[name]
    for path in candidates:
        if path.is_file():
            return str(path)
    names = ["soffice", "libreoffice"] if name == "office" else ["tesseract"]
    for n in names:
        found = shutil.which(n)
        if found:
            return found
    raise ValueError(f"The {'Office conversion' if name == 'office' else 'OCR'} engine is missing. Reinstall the full Windows package.")


def run_process(args, timeout=300, **kwargs):
    opts = {"creationflags": subprocess.CREATE_NO_WINDOW} if sys.platform == "win32" else {}
    result = subprocess.run(args, capture_output=True, timeout=timeout, **opts, **kwargs)
    if result.returncode:
        message = result.stderr.decode(errors="replace")[-1000:]
        raise ValueError(f"The processing engine failed: {message}")
    return result


def outcome(paths, message="Saved successfully.", **extra):
    return {"outputs": paths, "message": message, **extra}
