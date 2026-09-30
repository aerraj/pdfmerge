import io
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parent))
import pytest
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from main import dispatch

@pytest.fixture
def source(tmp_path):
    path = tmp_path/"source.pdf"
    b=io.BytesIO()
    c=canvas.Canvas(b,pagesize=(400,500))
    image=Image.effect_noise((1800,1800),80).convert("RGB")
    for i in range(3):
        c.setFont("Helvetica",18)
        c.drawString(30,450,f"Original secret page {i+1}")
        c.drawImage(ImageReader(image),30,180,180,180)
        c.showPage()
    c.save()
    w=PdfWriter(clone_from=PdfReader(b))
    w.add_outline_item("Second",1)
    with path.open("wb") as f:w.write(f)
    return path

def job(source,tmp_path,tool,**kw):
    output=tmp_path/(tool+".pdf")
    return dict(tool=tool,inputs=[str(source)],output=str(output),**kw)

def test_preview_replace_text_and_image(source,tmp_path):
    preview=dispatch(dict(tool="preview",inputs=[str(source)],page=0))
    assert preview["count"]==3 and preview["image"].startswith("data:image/png")
    text=next(o for o in preview["objects"] if o["kind"]=="text")
    image=next(o for o in preview["objects"] if o["kind"]=="image")
    req=job(source,tmp_path,"edit",operations=[
        dict(kind="text",objectId=text["id"],page=0,x=text["x"],y=text["y"],text="Replacement text",size=18),
        dict(kind="delete",objectId=image["id"],page=0)])
    dispatch(req)
    result=PdfReader(req["output"])
    assert "Replacement text" in result.pages[0].extract_text()
    assert "Original secret" not in result.pages[0].extract_text()
    assert "Original secret" in result.pages[1].extract_text()
    assert len(result.pages[0].images)==0

def test_real_redaction_removes_text(source,tmp_path):
    req=job(source,tmp_path,"edit",operations=[dict(kind="redact",page=0,x=0,y=0,width=400,height=100)])
    dispatch(req)
    r=PdfReader(req["output"])
    assert all(not p.extract_text().strip() for p in r.pages)
    assert b"secret" not in Path(req["output"]).read_bytes()

def test_form_creation_and_filling(source,tmp_path):
    req=job(source,tmp_path,"edit",operations=[dict(kind="field",page=0,x=30,y=100,width=180,height=30,text="Customer")])
    dispatch(req)
    fields=dispatch(dict(tool="form_fields",inputs=[req["output"]]))["fields"]
    assert fields[0]["name"]=="Customer"
    out=tmp_path/"filled.pdf"
    dispatch(dict(tool="fill_forms",inputs=[req["output"]],output=str(out),values={"Customer":"Ada Lovelace"}))
    assert PdfReader(out).get_fields()["Customer"]["/V"]=="Ada Lovelace"

@pytest.mark.parametrize("tool,count,options",[
    ("half",6,{}),("nup",2,{"amount":2}),("flip",3,{}),("resize",3,{"mode":"letter"}),
    ("header_footer",3,{"text":"Page {page} / {pages}"}),("bates",3,{"text":"CASE-","amount":10}),
    ("bookmarks",3,{"text":"2: Chapter two"}),("repair",3,{})])
def test_page_operations_open_and_have_expected_pages(source,tmp_path,tool,count,options):
    req=job(source,tmp_path,tool,**options)
    dispatch(req)
    r=PdfReader(req["output"])
    assert len(r.pages)==count
    if tool=="resize":assert float(r.pages[0].mediabox.width)==612
    if tool=="bates":assert "CASE-000010" in r.pages[0].extract_text()

@pytest.mark.parametrize("tool,options,counts",[
    ("split_bookmarks",{},[1,2]),("split_text",{"text":"page 3"},[2,1]),
    ("split_every",{"amount":2},[2,1]),("rename_text",{},[1,1,1])])
def test_split_boundaries(source,tmp_path,tool,options,counts):
    req=job(source,tmp_path,tool,**options);req["output"]=str(tmp_path/tool)
    result=dispatch(req)
    assert [len(PdfReader(p).pages) for p in result["outputs"]]==counts

def test_compression_reduces_image_pdf_and_preserves_text(source,tmp_path):
    req=job(source,tmp_path,"compress",mode="small")
    dispatch(req)
    assert Path(req["output"]).stat().st_size < source.stat().st_size
    assert "Original secret" in PdfReader(req["output"]).pages[0].extract_text()

@pytest.mark.parametrize("tool,extension",[("to_word","docx"),("to_excel","xlsx"),("to_powerpoint","pptx")])
def test_office_files_open_and_contain_editable_text(source,tmp_path,tool,extension):
    req=job(source,tmp_path,tool);req["output"]=str(tmp_path/("converted."+extension))
    dispatch(req)
    if tool=="to_word":
        from docx import Document
        assert any("Original secret" in p.text for p in Document(req["output"]).paragraphs)
    elif tool=="to_excel":
        from openpyxl import load_workbook
        assert load_workbook(req["output"]).active["A1"].value.startswith("Original")
    else:
        from pptx import Presentation
        prs=Presentation(req["output"])
        assert len(prs.slides)==3
        assert any("Original secret" in s.text for s in prs.slides[0].shapes if s.has_text_frame)

def test_certificate_signature_integrity(source,tmp_path):
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes,serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from datetime import datetime,timedelta,timezone
    from pyhanko.pdf_utils.reader import PdfFileReader
    from pyhanko.sign.validation import validate_pdf_signature
    from pyhanko_certvalidator import ValidationContext
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,"pdfmerge test")])
    cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(123).not_valid_before(datetime.now(timezone.utc)-timedelta(days=1)).not_valid_after(datetime.now(timezone.utc)+timedelta(days=1)).sign(key,hashes.SHA256())
    pfx=tmp_path/"test.pfx"
    pfx.write_bytes(pkcs12.serialize_key_and_certificates(b"test",key,cert,None,serialization.BestAvailableEncryption(b"pass")))
    req=job(source,tmp_path,"digital_sign",certificate=str(pfx),password="pass")
    dispatch(req)
    with open(req["output"],"rb") as f:
        pdf=PdfFileReader(f)
        assert len(pdf.embedded_signatures)==1
        status=validate_pdf_signature(pdf.embedded_signatures[0],signer_validation_context=ValidationContext(allow_fetching=False))
        assert status.intact and status.valid

def test_never_overwrite_input(source,tmp_path):
    original=source.read_bytes()
    with pytest.raises(ValueError):
        dispatch(dict(tool="repair",inputs=[str(source)],output=str(source)))
    assert source.read_bytes()==original
