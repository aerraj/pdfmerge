import base64
import io
import math
from pathlib import Path
import ctypes
from PIL import Image, ImageDraw, ImageChops
import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link, Highlight
from pypdf.generic import NameObject, ArrayObject, DictionaryObject, BooleanObject, FloatObject
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import reportlab
from common import normalize, reader, render, image_data, image_pdf, write_pdf, atomic_bytes, outcome

pdfmetrics.registerFont(TTFont("Vera", str(Path(reportlab.__file__).parent / "fonts/Vera.ttf")))

FONTS = {
    "sans": ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"),
    "serif": ("Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"),
    "mono": ("Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"),
    "vera": ("Vera", "Vera", "Vera", "Vera"),
}


def font_for(op):
    family = FONTS.get(op.get("font", "sans"), FONTS["sans"])
    return family[(1 if op.get("bold") else 0) + (2 if op.get("italic") else 0)]


def signature_image(req):
    """Prepare an uploaded signature without changing the user's source image."""
    image = Image.open(req["inputs"][0]).convert("RGBA")
    if req.get("removeBackground", False):
        import numpy as np
        pixels = np.asarray(image, dtype=np.uint8).copy()
        rgb = pixels[:, :, :3].astype(np.float32)
        # Sample the paper around the edge, so white and lightly tinted paper work.
        edge = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]))
        paper = np.median(edge, axis=0)
        difference = np.max(np.abs(rgb - paper), axis=2)
        alpha = np.clip((difference - 12) * 255 / 80, 0, 255).astype(np.uint8)
        pixels[:, :, 3] = np.minimum(pixels[:, :, 3], alpha)
        image = Image.fromarray(pixels, "RGBA")
        bounds = image.getchannel("A").getbbox()
        if not bounds:
            raise ValueError("No visible signature was found in the picture.")
        margin = max(3, round(min(image.size) * .02))
        image = image.crop((max(0, bounds[0] - margin), max(0, bounds[1] - margin),
                            min(image.width, bounds[2] + margin), min(image.height, bounds[3] + margin)))
    output = io.BytesIO()
    image.save(output, "PNG")
    return {"data": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode(),
            "width": image.width, "height": image.height}


def draw_signature(c, op, x, y, width, height):
    """Stamp the final rectangle; drawn signatures retain their original vector strokes."""
    paths = op.get("signaturePaths")
    if not paths:
        # Embed the full image. Sizing the PDF rectangle must not resample its pixels.
        c.drawImage(ImageReader(image_data(op["data"])), x, y, width, height, mask="auto")
        return
    viewbox = op.get("signatureViewBox", {})
    view_width, view_height = float(viewbox.get("width", 0)), float(viewbox.get("height", 0))
    stroke = float(op.get("signatureStrokeWidth", 3))
    if not all(math.isfinite(value) and value > 0 for value in (view_width, view_height, stroke)):
        raise ValueError("The drawn signature has an invalid size. Draw it again before saving.")
    c.saveState()
    # Both preview points and signature points have a top-left origin.
    c.translate(x, y + height)
    c.scale(width / view_width, -height / view_height)
    clip = c.beginPath()
    clip.rect(0, 0, view_width, view_height)
    c.clipPath(clip, stroke=0, fill=0)
    c.setLineWidth(stroke)
    c.setLineCap(1)
    c.setLineJoin(1)
    for points in paths:
        if not points:
            continue
        if any(len(point) != 2 or not all(math.isfinite(float(value)) for value in point) for point in points):
            raise ValueError("The drawn signature contains an invalid stroke. Draw it again before saving.")
        if len(points) == 1:
            c.circle(float(points[0][0]), float(points[0][1]), stroke / 2, fill=1, stroke=0)
            continue
        path = c.beginPath()
        path.moveTo(float(points[0][0]), float(points[0][1]))
        for px, py in points[1:]:
            path.lineTo(float(px), float(py))
        c.drawPath(path)
    c.restoreState()


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
        pdf_page = PdfReader(io.BytesIO(data)).pages[index]
        for ident, reference in enumerate(pdf_page.get("/Annots", [])):
            ann = reference.get_object()
            if ann.get("/Subtype") != "/Link" or not ann.get("/Rect"):
                continue
            x1, y1, x2, y2 = [float(v) for v in ann["/Rect"]]
            action = ann.get("/A", {})
            objects.append({"id": ident, "annotationId": ident, "kind": "link", "x": x1,
                            "y": height-y2, "width": x2-x1, "height": y2-y1,
                            "text": str(action.get("/URI", ""))})
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
        output = atomic_bytes(req["output"], data)
        return {"message": "Saved the PDF without overlay edits.", "outputs": [output]}
    normalized_pages = PdfReader(io.BytesIO(data)).pages
    for op in operations:
        if op.get("kind") != "signature":
            continue
        index = int(op.get("page", 0))
        if not 0 <= index < len(normalized_pages):
            raise ValueError("The signature page is outside this PDF.")
        page = normalized_pages[index]
        x, y = float(op.get("x", 0)), float(op.get("y", 0))
        width, height = float(op.get("width", 120)), float(op.get("height", 30))
        if (not all(math.isfinite(value) for value in (x, y, width, height)) or
                width <= 0 or height <= 0 or x < -0.01 or y < -0.01 or
                x + width > float(page.mediabox.width) + 0.01 or
                y + height > float(page.mediabox.height) + 0.01):
            raise ValueError("A signature is outside its page. Move or resize it before saving.")
    # Remove original objects before overlaying replacements. Old text is not hidden under paint.
    with pdfium.PdfDocument(data) as doc:
        for index in range(len(doc)):
            removals = {int(op["objectId"]) for op in operations if int(op.get("page", 0)) == index and "objectId" in op}
            replacements = [op for op in operations if op["kind"] == "find_replace" and (op.get("scope", "all") == "all" or int(op.get("page", 0)) == index)]
            if replacements:
                page = doc[index]
                textpage = page.get_textpage()
                for ident, obj in enumerate(page.get_objects(textpage=textpage)):
                    if obj.type != pdfium.raw.FPDF_PAGEOBJ_TEXT or ident in removals:
                        continue
                    original = obj.extract()
                    modified = original
                    for op in replacements:
                        needle = op.get("find", "")
                        if not needle:
                            continue
                        if op.get("matchCase"):
                            modified = modified.replace(needle, op.get("replace", ""))
                        else:
                            import re
                            modified = re.sub(re.escape(needle), lambda match: op.get("replace", ""), modified, flags=re.IGNORECASE)
                    if modified != original:
                        left, bottom, right, top = obj.get_bounds()
                        size = obj.get_font_size()
                        operations.append({"kind": "text", "page": index, "objectId": ident,
                                           "x": left, "y": page.get_size()[1] - top,
                                           "width": right - left, "height": top - bottom,
                                           "text": modified, "size": size,
                                           "font": replacements[-1].get("font", "sans")})
                        removals.add(ident)
                textpage.close()
                page.close()
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
        ann_removals = {int(op["annotationId"]) for op in operations if
                        int(op.get("page", 0)) == index and "annotationId" in op}
        if ann_removals and page.get("/Annots"):
            page[NameObject("/Annots")] = ArrayObject([ann for ident, ann in
                                                        enumerate(page["/Annots"]) if ident not in ann_removals])
    for index, page in enumerate(w.pages):
        page_ops = [op for op in operations if int(op.get("page", 0)) == index]
        if not page_ops:
            continue
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(width, height))
        links, highlights, redactions = [], [], []
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
                c.setFont(font_for(op), size)
                for line_no, line in enumerate(op.get("text", "").splitlines()):
                    c.drawString(x, height - top - size - line_no * size * 1.2, line)
            elif kind == "signature":
                draw_signature(c, op, x, y, ow, oh)
            elif kind == "image":
                image = image_data(op["data"])
                c.drawImage(ImageReader(image), x, y, ow, oh, mask="auto")
            elif kind == "rectangle":
                c.rect(x, y, ow, oh, fill=int(op.get("fill", False)))
            elif kind == "ellipse":
                c.ellipse(x, y, x + ow, y + oh, fill=int(op.get("fill", False)))
            elif kind == "line":
                c.line(x, height - top, x + ow, y)
            elif kind == "arrow":
                x2, y2 = x + ow, y
                y1 = height - top
                c.line(x, y1, x2, y2)
                angle = math.atan2(y2-y1, x2-x)
                wing = max(7, float(op.get("stroke", 2)) * 4)
                for a in (angle + 2.55, angle - 2.55):
                    c.line(x2, y2, x2 + wing * math.cos(a), y2 + wing * math.sin(a))
            elif kind == "ink":
                points = op.get("points", [])
                if len(points) > 1:
                    path = c.beginPath()
                    path.moveTo(points[0][0], height - points[0][1])
                    for px, py in points[1:]:
                        path.lineTo(px, height - py)
                    c.drawPath(path)
            elif kind == "link":
                url = op.get("url", "").strip()
                target = op.get("targetPage")
                if target is not None:
                    target = int(target) - 1
                    if not 0 <= target < len(w.pages):
                        raise ValueError("The link's destination page is outside this PDF.")
                elif not url.startswith(("https://", "http://", "mailto:", "tel:")):
                    raise ValueError("Links must use an HTTPS, HTTP, email, phone, or page destination.")
                links.append((x, y, x + ow, y + oh, url, target))
            elif kind in ("field", "multiline"):
                name = op.get("text", "").strip() or f"Field{index}_{len(page_ops)}"
                c.acroForm.textfield(name=name, x=x, y=y, width=ow, height=oh,
                                    borderWidth=1, forceBorder=True, fontSize=12,
                                    fieldFlags="multiline" if kind == "multiline" else "")
            elif kind == "checkbox":
                c.acroForm.checkbox(name=op.get("text") or f"Check{index}_{x}_{y}",
                                     x=x, y=y, size=min(ow, oh), buttonStyle="check")
            elif kind == "dropdown":
                values = [v.strip() for v in op.get("options", "").splitlines() if v.strip()]
                if not values:
                    raise ValueError("A drop-down field needs at least one option.")
                c.acroForm.choice(name=op.get("text") or f"Choice{index}_{x}_{y}",
                                  x=x, y=y, width=ow, height=oh, options=values, value=values[0],
                                  forceBorder=True, fontSize=12)
            elif kind == "radio":
                c.acroForm.radio(name=op.get("text") or "RadioGroup", value=op.get("value") or f"Choice{round(x)}",
                                 x=x, y=y, size=min(ow, oh), selected=bool(op.get("selected")),
                                 forceBorder=True)
            elif kind == "whiteout":
                c.setFillColor(HexColor("#ffffff"))
                c.rect(x, y, ow, oh, fill=1, stroke=0)
            elif kind == "highlight":
                highlights.append((x, y, x + ow, y + oh, op.get("color", "#ffec66")))
            elif kind in ("strikeout", "underline"):
                mark_y = y + (oh / 2 if kind == "strikeout" else max(1, oh * .12))
                c.line(x, mark_y, x + ow, mark_y)
            elif kind == "redact":
                redactions.append((x, top, x + ow, top + oh))
            elif kind not in ("delete", "find_replace"):
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
            radio_widgets = [ann for ann in page.get("/Annots", []) if
                             ann.get_object().get("/Subtype") == "/Widget" and
                             ann.get_object().get("/FT") == "/Btn" and
                             not ann.get_object().get("/T")]
            for field in source_form.get("/Fields", []):
                original = field.get_object()
                if original.get("/Kids") and original.get("/FT") == "/Btn":
                    group = field.clone(w)
                    children = radio_widgets[:len(original["/Kids"])]
                    radio_widgets = radio_widgets[len(children):]
                    group.get_object()[NameObject("/Kids")] = ArrayObject(children)
                    for child in children:
                        child.get_object()[NameObject("/Parent")] = group
                    target["/Fields"].append(group)
            for ann in page.get("/Annots", []):
                a = ann.get_object()
                if a.get("/Subtype") == "/Widget" and str(ann) not in known and not a.get("/Parent"):
                    target["/Fields"].append(ann)
        for x1, y1, x2, y2, url, target in links:
            w.add_annotation(index, Link(rect=(x1, y1, x2, y2), target_page_index=target) if target is not None else Link(rect=(x1, y1, x2, y2), url=url))
        for x1, y1, x2, y2, color in highlights:
            quad = ArrayObject([FloatObject(v) for v in (x1,y2,x2,y2,x1,y1,x2,y1)])
            w.add_annotation(index, Highlight(rect=(x1,y1,x2,y2), quad_points=quad,
                                              highlight_color=color.lstrip("#")))
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
