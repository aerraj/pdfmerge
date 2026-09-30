"""Windows gates for the actual distributable, Office and OCR."""
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import pytest
from pypdf import PdfReader
from reportlab.pdfgen import canvas
ROOT=Path(__file__).resolve().parents[1]
EXE=Path(os.environ.get("PDFMERGE_TEST_ENGINE", ROOT/"src-tauri/resources/pdfmerge-engine"/("pdfmerge-engine.exe" if sys.platform=="win32" else "pdfmerge-engine")))
pytestmark=pytest.mark.skipif(sys.platform not in ("win32","darwin"),reason="Desktop package gate")

def packaged(request):
    proc=subprocess.run([str(EXE)],input=json.dumps(request).encode(),capture_output=True,timeout=360)
    result=json.loads(proc.stdout)
    assert result.get("ok"),result
    return result["result"]

def test_packaged_preview_and_office_exports(tmp_path):
    source=tmp_path/"sample.pdf"
    c=canvas.Canvas(str(source))
    c.drawString(40,700,"Packaged engine test")
    c.save()
    assert packaged(dict(tool="preview",inputs=[str(source)]))["count"]==1
    for tool,ext in [("to_word","docx"),("to_excel","xlsx"),("to_powerpoint","pptx")]:
        output=tmp_path/f"{tool}.{ext}"
        packaged(dict(tool=tool,inputs=[str(source)],output=str(output)))
        back=tmp_path/f"{tool}-roundtrip.pdf"
        packaged(dict(tool="office_pdf",inputs=[str(output)],output=str(back)))
        assert len(PdfReader(back).pages)>=1
    archival=tmp_path/"archival.pdf"
    packaged(dict(tool="pdfa",inputs=[str(source)],output=str(archival)))
    assert b"pdfaid" in archival.read_bytes()

def test_packaged_ocr_and_html(tmp_path):
    source=tmp_path/"scan.pdf"
    c=canvas.Canvas(str(source))
    c.setFont("Helvetica",32)
    c.drawString(60,500,"HELLO PDFMERGE")
    c.save()
    output=tmp_path/"ocr.pdf"
    packaged(dict(tool="ocr",inputs=[str(source)],output=str(output),language="eng"))
    assert "HELLO" in PdfReader(output).pages[0].extract_text()
    html=tmp_path/"test.html"
    html.write_text("<html><body><h1>HTML conversion</h1></body></html>")
    result=tmp_path/"html.pdf"
    packaged(dict(tool="html_pdf",inputs=[str(html)],output=str(result)))
    assert len(PdfReader(result).pages)==1


def test_packaged_editor_and_uploaded_signature(tmp_path):
    from PIL import Image, ImageDraw
    source=tmp_path/"editor.pdf"
    c=canvas.Canvas(str(source));c.drawString(40,700,"Replace this phrase");c.save()
    image=Image.new("RGB",(240,100),"#fff8eb")
    ImageDraw.Draw(image).line((30,75,100,20,205,60),fill="#142c88",width=6)
    picture=tmp_path/"signature.png";image.save(picture)
    prepared=packaged(dict(tool="signature_image",inputs=[str(picture)],removeBackground=True))
    assert prepared["data"].startswith("data:image/png")
    result=tmp_path/"edited.pdf"
    packaged(dict(tool="edit",inputs=[str(source)],output=str(result),operations=[
        dict(kind="find_replace",page=0,scope="all",find="Replace",replace="Edit",matchCase=False),
        dict(kind="signature",page=0,x=40,y=100,width=180,height=75,data=prepared["data"])]))
    document=PdfReader(result)
    assert "Edit this phrase" in document.pages[0].extract_text()
    assert document.pages[0].images
