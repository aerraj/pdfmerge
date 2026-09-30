import base64
import io
from pathlib import Path
import ctypes
from PIL import Image, ImageDraw, ImageChops
import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link
from pypdf.generic import NameObject, ArrayObject, DictionaryObject, BooleanObject
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import reportlab
from common import normalize, reader, render, image_data, image_pdf, write_pdf, atomic_bytes, outcome

pdfmetrics.registerFont(TTFont("Vera", str(Path(reportlab.__file__).parent / "fonts/Vera.ttf")))


def preview(req):
    data = normalize(req["inputs"][0])
    with pdfium.PdfDocument(data) as doc:
        index = max(0, min(int(req.get("page", 0)), len(doc) - 1))
        page = doc[index]
        width, height = page.get_size()
        objects = []
        textpage = page.get_textpage()
        for ident, obj in enumerate(page.get_objects(textpage=textpage)):
            if obj.type not in (pdfium.raw.FPDF_PAGEOBJ_TEXT, pdfium.raw.FPDF_PAGEOBJ_IMAGE):
                continue
            left, bottom, right, top = obj.get_bounds()
            item = {"id": ident, "x": left, "y": height - top, "width": right - left, "height": top - bottom,
                    "kind": "text" if obj.type == pdfium.raw.FPDF_PAGEOBJ_TEXT else "image"}
            if item["kind"] == "text":
                item["text"] = obj.extract()
                item["size"] = obj.get_font_size()
            objects.append(item)
        textpage.close()
        bitmap = page.render(scale=min(1.5, 1600 / max(width, height)))
        b = io.BytesIO()
        bitmap.to_pil().save(b, "PNG")
        bitmap.close()
        page.close()
        return {"count": len(doc), "page": index, "width": width, "height": height,
                "image": "data:image/png;base64," + base64.b64encode(b.getvalue()).decode(), "objects": objects}


def edit(req):
    data = normalize(req["inputs"][0])
    operations = req.get("operations", [])
    if not operations:
        raise ValueError("Add an edit or a signature before saving.")
    # Remove original objects before overlaying replacements. Old text is not hidden under paint.
    with pdfium.PdfDocument(data) as doc:
        for index in range(len(doc)):
            removals = {int(op["objectId"]) for op in operations if int(op.get("page", 0)) == index and "objectId" in op}
            if not removals:
                continue
            page = doc[index]
            objects = list(page.get_objects())
            for ident in removals:
                if ident < 0 or ident >= len(objects):
                    raise ValueError("The page changed. Reopen it before editing.")
                obj = objects[ident]
                page.remove_obj(obj)
                obj.close()
            page.gen_content()
            page.close()
        b = io.BytesIO()
        doc.save(b)
        data = b.getvalue()
    r = PdfReader(io.BytesIO(data))
    w = PdfWriter()
    w.append(r)
    for index, page in enumerate(w.pages):
        page_ops = [op for op in operations if int(op.get("page", 0)) == index]
        if not page_ops:
            continue
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(width, height))
        links, redactions = [], []
        for op in page_ops:
            kind = op["kind"]
            x, top = float(op.get("x", 0)), float(op.get("y", 0))
            ow, oh = float(op.get("width", 120)), float(op.get("height", 30))
            y = height - top - oh
            c.setFillColor(HexColor(op.get("color", "#16291d")))
            c.setStrokeColor(HexColor(op.get("color", "#16291d")))
            c.setLineWidth(float(op.get("stroke", 2)))
            if kind == "text":
                size = max(5, min(144, float(op.get("size", 16))))
                c.setFont("Vera", size)
                for line_no, line in enumerate(op.get("text", "").splitlines()):
                    c.drawString(x, height - top - size - line_no * size * 1.2, line)
            elif kind in ("image", "signature"):
                image = image_data(op["data"])
                c.drawImage(ImageReader(image), x, y, ow, oh, mask="auto")
            elif kind == "rectangle":
                c.rect(x, y, ow, oh, fill=int(op.get("fill", False)))
            elif kind == "ellipse":
                c.ellipse(x, y, x + ow, y + oh, fill=int(op.get("fill", False)))
            elif kind == "line":
                c.line(x, height - top, x + ow, y)
            elif kind == "ink":
                points = op.get("points", [])
                if len(points) > 1:
                    path = c.beginPath()
                    path.moveTo(points[0][0], height - points[0][1])
                    for px, py in points[1:]:
                        path.lineTo(px, height - py)
                    c.drawPath(path)
            elif kind == "link":
                url = op.get("url", "")
                if not url.startswith(("https://", "http://", "mailto:")):
                    raise ValueError("Links must begin with https://, http://, or mailto:.")
                links.append((x, y, x + ow, y + oh, url))
            elif kind == "field":
                name = op.get("text", "").strip() or f"Field{index}_{len(page_ops)}"
                c.acroForm.textfield(name=name, x=x, y=y, width=ow, height=oh,
                                    borderWidth=1, forceBorder=True, fontSize=12)
            elif kind == "checkbox":
                c.acroForm.checkbox(name=op.get("text") or f"Check{index}_{x}_{y}",
                                     x=x, y=y, size=min(ow, oh), buttonStyle="check")
            elif kind == "redact":
                redactions.append((x, top, x + ow, top + oh))
            elif kind != "delete":
                raise ValueError(f"Unknown edit: {kind}")
        c.showPage()
        c.save()
        over = PdfReader(buf)
        page.merge_page(over.pages[0])
        # Keep form fields registered in the output catalog as well as on the page.
        source_form = over.trailer["/Root"].get("/AcroForm")
        if source_form:
            target = w._root_object.get("/AcroForm")
            if not target:
                target = DictionaryObject({NameObject("/Fields"): ArrayObject()})
                w._root_object[NameObject("/AcroForm")] = w._add_object(target)
            else:
                target = target.get_object()
            source_form = source_form.get_object()
            for key in ("/DA", "/DR"):
                if key in source_form:
                    target[NameObject(key)] = source_form[key].clone(w)
            target[NameObject("/NeedAppearances")] = BooleanObject(False)
            # merge_page clones the annotation array; register the cloned widgets.
            known = {str(f) for f in target["/Fields"]}
            for ann in page.get("/Annots", []):
                a = ann.get_object()
                if a.get("/Subtype") == "/Widget" and str(ann) not in known:
                    target["/Fields"].append(ann)
        for x1, y1, x2, y2, url in links:
            w.add_annotation(index, Link(rect=(x1, y1, x2, y2), url=url))
    # Redaction rebuilds the entire document as pixels, eliminating hidden text, attachments,
    # metadata, layers and annotations. This is an explicit destructive-content operation.
    if any(op["kind"] == "redact" for op in operations):
        content = io.BytesIO()
        w.write(content)
        images, sizes = [], []
        for index, page in enumerate(w.pages):
            image = render(content.getvalue(), index, 144).convert("RGB")
            draw = ImageDraw.Draw(image)
            for op in operations:
                if op["kind"] == "redact" and int(op.get("page", 0)) == index:
                    x, y = float(op["x"]), float(op["y"])
                    draw.rectangle((x * 2, y * 2, (x + float(op["width"])) * 2,
                                    (y + float(op["height"])) * 2), fill="black")
            images.append(image)
            sizes.append((float(page.mediabox.width), float(page.mediabox.height)))
        path = atomic_bytes(req["output"], image_pdf(images, sizes, 95))
        return outcome([path], "Redacted PDF saved. Pages are flattened to images.")
    return outcome([write_pdf(w, req["output"])])


def form_fields(req):
    fields = reader(req["inputs"][0]).get_fields() or {}
    return {"fields": [{"name": name, "type": str(f.get("/FT", "")),
                         "value": str(f.get("/V", "")), "options": [str(v) for v in f.get("/_States_", f.get("/Opt", []))]}
                        for name, f in fields.items()]}


def fill_forms(req):
    r = reader(req["inputs"][0])
    if not r.get_fields():
        raise ValueError("This PDF has no interactive fields. Add fields in Edit PDF.")
    w = PdfWriter(clone_from=r)
    values = req.get("values", {})
    w.update_page_form_field_values(None, values, auto_regenerate=False)
    return outcome([write_pdf(w, req["output"])])


def digital_sign(req):
    from pyhanko.sign import signers, fields
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    cert = req.get("certificate", "")
    signer = signers.SimpleSigner.load_pkcs12(cert, passphrase=req.get("password", "").encode())
    if signer is None:
        raise ValueError("Could not open the signing certificate. Check the PFX file and password.")
    r = reader(req["inputs"][0])
    page = int(req.get("page", 0))
    if not 0 <= page < len(r.pages):
        raise ValueError("The signature page is outside this PDF.")
    name = "pdfmergeSignature"
    existing = r.get_fields() or {}
    while name in existing:
        name += "_"
    metadata = signers.PdfSignatureMetadata(field_name=name, reason=req.get("text", "") or None)
    box = (36, 36, 260, 108)
    with open(req["inputs"][0], "rb") as source:
        result = io.BytesIO()
        signers.sign_pdf(IncrementalPdfFileWriter(source), metadata, signer=signer,
                        new_field_spec=fields.SigFieldSpec(name, on_page=page, box=box), output=result)
    return outcome([atomic_bytes(req["output"], result.getvalue())], "Certificate signature added. Trust depends on the certificate issuer.")


def compare(req):
    left, right = [normalize(p) for p in req["inputs"][:2]]
    lr, rr = PdfReader(io.BytesIO(left)), PdfReader(io.BytesIO(right))
    b = io.BytesIO()
    c = canvas.Canvas(b, pagesize=(1200, 900))
    changed = 0
    for i in range(max(len(lr.pages), len(rr.pages))):
        images = [render(d, i, 72).convert("RGB") if i < len(r.pages) else Image.new("RGB", (612, 792), "white")
                  for d, r in ((left, lr), (right, rr))]
        size = (max(im.width for im in images), max(im.height for im in images))
        padded = []
        for im in images:
            panel = Image.new("RGB", size, "white")
            panel.paste(im, (0, 0))
            padded.append(panel)
        diff = ImageChops.difference(*padded).convert("L").point(lambda p: 255 if p > 35 else 0)
        is_changed = bool(diff.getbbox())
        changed += int(is_changed)
        marked = padded[1].copy()
        red = Image.new("RGB", size, "#ff4e60")
        marked = Image.composite(Image.blend(marked, red, .6), marked, diff)
        c.setFont("Helvetica", 16)
        c.drawString(30, 865, f"Page {i+1} — {'differences highlighted' if is_changed else 'no visible difference'}")
        c.drawString(30, 835, "Original")
        c.drawString(615, 835, "Compared")
        for im, x in ((padded[0], 30), (marked, 615)):
            c.drawImage(ImageReader(im), x, 30, 555, 790, preserveAspectRatio=True, anchor="c")
        c.showPage()
    c.save()
    return outcome([atomic_bytes(req["output"], b.getvalue())], f"Comparison saved. {changed} pages differ.")
