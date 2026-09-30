import copy
import io
import math
from pathlib import Path
import re
from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject
from reportlab.lib.colors import HexColor
from common import *


def grouped_output(req, r, groups, names=None):
    folder = Path(req["output"])
    folder.mkdir(parents=True, exist_ok=True)
    stem = Path(req["inputs"][0]).stem
    paths = [folder / (names[i] if names else f"{stem}-part-{i+1:03}.pdf") for i in range(len(groups))]
    if any(p.exists() for p in paths):
        raise ValueError("An output file already exists. Choose an empty folder.")
    for group, path in zip(groups, paths):
        write_pdf(subset(r, group), path)
    return outcome([str(p) for p in paths], f"Created {len(paths)} PDFs.")


def page_tools(req):
    tool = req["tool"]
    inputs = req["inputs"]
    r = reader(inputs[0])
    count = len(r.pages)
    if tool.startswith("split_"):
        if tool == "split_bookmarks":
            starts = []
            def visit(items):
                for item in items:
                    if isinstance(item, list):
                        visit(item)
                    else:
                        try:
                            starts.append(r.get_destination_page_number(item))
                        except Exception:
                            pass
            visit(r.outline)
            starts = sorted(set([0] + [p for p in starts if p is not None and 0 <= p < count] + [count]))
            if len(starts) < 3:
                raise ValueError("No usable bookmark boundaries were found.")
            groups = [list(range(a, b)) for a, b in zip(starts, starts[1:])]
        elif tool == "split_text":
            text = req.get("text", "").strip()
            if not text:
                raise ValueError("Enter text to use as a split boundary.")
            starts = [0] + [i for i, p in enumerate(r.pages) if i > 0 and text.casefold() in (p.extract_text() or "").casefold()] + [count]
            groups = [list(range(a, b)) for a, b in zip(starts, starts[1:])]
        elif tool == "split_size":
            limit = max(.1, float(req.get("amount", 5))) * 1024 * 1024
            groups, current = [], []
            for i in range(count):
                trial = current + [i]
                if current and len(pdf_bytes(subset(r, trial))) > limit:
                    groups.append(current)
                    current = [i]
                else:
                    current = trial
            if current:
                groups.append(current)
            result = grouped_output(req, r, groups)
            result["message"] += " A single page can exceed the size target."
            return result
        elif tool == "split_every":
            n = max(1, int(req.get("amount", 1)))
            groups = [list(range(i, min(i+n, count))) for i in range(0, count, n)]
        else:
            raise ValueError("Unknown split mode.")
        return grouped_output(req, r, groups)
    if tool == "alternate":
        readers = [reader(p) for p in inputs]
        w = PdfWriter()
        for i in range(max(len(d.pages) for d in readers)):
            for d in readers:
                if i < len(d.pages):
                    w.add_page(d.pages[i])
        return outcome([write_pdf(w, req["output"])])
    if tool == "rename_text":
        names = []
        for i, p in enumerate(r.pages):
            text = re.sub(r'[^\w -]', '', (p.extract_text() or "").strip().split("\n")[0])[:55].strip()
            names.append(f"{i+1:03}-{text or 'page'}.pdf")
        return grouped_output(req, r, [[i] for i in range(count)], names)
    if tool == "bookmarks":
        w = PdfWriter(clone_from=r)
        for line in req.get("text", "").splitlines():
            number, sep, title = line.partition(":")
            if not sep or not title.strip():
                raise ValueError("Use one bookmark per line: page number: title")
            p = int(number) - 1
            if not 0 <= p < count:
                raise ValueError("A bookmark page is outside the PDF.")
            w.add_outline_item(title.strip(), p)
        return outcome([write_pdf(w, req["output"])])
    data = normalize(inputs[0])
    r = PdfReader(io.BytesIO(data))
    w = PdfWriter()
    if tool == "half":
        for p in r.pages:
            width, height = float(p.mediabox.width), float(p.mediabox.height)
            vertical = req.get("mode", "vertical") == "vertical"
            for half in (0, 1):
                q = copy.deepcopy(p)
                rect = [half*width/2, 0, (half+1)*width/2, height] if vertical else [0, (1-half)*height/2, width, (2-half)*height/2]
                q.cropbox = RectangleObject(rect)
                w.add_page(q)
    elif tool == "nup":
        n = int(req.get("amount", 2))
        if n not in (2, 4, 6, 9):
            raise ValueError("Choose 2, 4, 6 or 9 pages per sheet.")
        cols = 2 if n in (2, 4, 6) else 3
        rows = math.ceil(n/cols)
        sw, sh = (842, 595) if n == 2 else (595, 842)
        for start in range(0, count, n):
            sheet = w.add_blank_page(sw, sh)
            for j, page in enumerate(r.pages[start:start+n]):
                cellw, cellh = sw/cols, sh/rows
                pw, ph = float(page.mediabox.width), float(page.mediabox.height)
                scale = min((cellw-20)/pw, (cellh-20)/ph)
                x = (j%cols)*cellw + (cellw-pw*scale)/2
                y = sh-(j//cols+1)*cellh + (cellh-ph*scale)/2
                sheet.merge_transformed_page(page, Transformation().scale(scale).translate(x,y))
    elif tool in ("grayscale", "flatten"):
        images = [render(data, i, 144) for i in range(count)]
        if tool == "grayscale":
            images = [ImageOps.grayscale(im) for im in images]
        sizes = [(float(p.mediabox.width), float(p.mediabox.height)) for p in r.pages]
        return outcome([atomic_bytes(req["output"], image_pdf(images, sizes, 95))],
                       "Saved flattened image pages." if tool == "flatten" else "Saved grayscale image pages.")
    else:
        for i, p in enumerate(r.pages):
            width, height = float(p.mediabox.width), float(p.mediabox.height)
            if tool == "flip":
                if req.get("mode", "horizontal") == "horizontal":
                    p.add_transformation(Transformation((-1, 0, 0, 1, width, 0)))
                else:
                    p.add_transformation(Transformation((1, 0, 0, -1, 0, height)))
            elif tool == "resize":
                target = {"a4": (595.28, 841.89), "letter": (612, 792), "a3": (841.89, 1190.55)}[req.get("mode", "a4")]
                scale = min(target[0]/width, target[1]/height)
                p.add_transformation(Transformation().scale(scale).translate((target[0]-width*scale)/2, (target[1]-height*scale)/2))
                p.mediabox = RectangleObject([0,0,*target])
                p.cropbox = RectangleObject([0,0,*target])
            elif tool in ("header_footer", "bates"):
                label = req.get("text", "").replace("{page}", str(i+1)).replace("{pages}", str(count))
                if tool == "bates":
                    label = f"{req.get('text', '')}{int(req.get('amount', 1))+i:06}"
                def draw(c, pw, ph):
                    c.setFont("Helvetica", 11)
                    c.setFillColor(HexColor("#24382b"))
                    c.drawString(28, ph-28 if req.get("mode") == "header" else 24, label)
                overlay(p, draw)
            elif tool == "repair":
                pass
            else:
                raise ValueError("Unknown page tool.")
            w.add_page(p)
    w.compress_identical_objects()
    return outcome([write_pdf(w, req["output"])])


def compress(req):
    r = reader(req["inputs"][0])
    w = PdfWriter(clone_from=r)
    preset = req.get("mode", "balanced")
    quality, maximum = {"gentle": (85,2400), "balanced": (65,1600), "small": (42,1000)}[preset]
    visited = set()
    changed = 0
    for page in w.pages:
        for image in list(page.images):
            ref = image.indirect_reference
            if ref is None or ref.idnum in visited:
                continue
            visited.add(ref.idnum)
            im = image.image
            if im.width < 150 or im.height < 150:
                continue
            im = im.convert("RGB")
            im.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
            image.replace(im, quality=quality, optimize=True)
            changed += 1
        page.compress_content_streams()
    w.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    original = Path(req["inputs"][0]).read_bytes()
    result = pdf_bytes(w)
    if len(result) >= len(original):
        result = original
    percent = 100 * (1-len(result)/len(original))
    return outcome([atomic_bytes(req["output"], result)],
                   f"Saved {percent:.1f}% smaller ({len(original):,} → {len(result):,} bytes). Text stays selectable.")
