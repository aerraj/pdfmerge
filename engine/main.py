import json
import sys
import traceback
from common import *
from editor import preview, edit, form_fields, fill_forms, digital_sign, compare
from pages import page_tools, compress
from conversion import office_convert, to_office, image_conversion, scan, ocr_or_deskew

PAGE_TOOLS = {"split_bookmarks","split_text","split_size","split_every","alternate","rename_text","bookmarks",
              "half","nup","grayscale","flatten","flip","resize","header_footer","bates","repair"}

def dispatch(req):
    tool = req["tool"]
    if tool == "read_image":
        image = Image.open(req["inputs"][0]).convert("RGBA")
        image.thumbnail((2400, 2400))
        b = io.BytesIO()
        image.save(b, "PNG")
        return {"data": "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()}
    handlers = {
        "preview":preview,"edit":edit,"form_fields":form_fields,"fill_forms":fill_forms,
        "digital_sign":digital_sign,"compare":compare,"compress":compress,
        "office_pdf":office_convert,"html_pdf":office_convert,"pdfa":office_convert,
        "to_word":to_office,"to_excel":to_office,"to_powerpoint":to_office,
        "images_pdf":image_conversion,"to_images":image_conversion,"extract_images":image_conversion,
        "scan":scan,"ocr":ocr_or_deskew,"deskew":ocr_or_deskew,
    }
    if tool in PAGE_TOOLS:
        return page_tools(req)
    if tool not in handlers:
        raise ValueError("Unknown tool.")
    return handlers[tool](req)

if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        result = dispatch(request)
        print(json.dumps({"ok":True,"result":result}))
    except Exception as exc:
        print(json.dumps({"ok":False,"error":str(exc)}))
        sys.exit(1)
