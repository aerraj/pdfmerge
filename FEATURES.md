# Feature comparison

The feature inventory draws from the installed iLovePDF desktop app and the public [iLovePDF Desktop](https://www.ilovepdf.com/desktop), [Sejda](https://www.sejda.com/), and [Sejda Desktop](https://www.sejda.com/desktop) tool catalogs, checked on September 30, 2026. Tool names vary by product and several products group related workflows differently. This is an implementation map for pdfmerge, not a claim of compatibility with either product.

## Available in pdfmerge 0.2.0

| Area | Tools | Scope |
| --- | --- | --- |
| Organize | Merge, split, extract, remove, reorder, rotate | Split creates one PDF per page; page selection accepts numbers and ranges. |
| Edit | Crop, page numbers, watermark, remove annotations, metadata | Crop changes the visible page box; watermark is centered basic Latin text. |
| Optimize | Lossless repack | Does not downsample images. |
| Security | Protect, unlock | Protect uses AES-128 and an open password. Unlock requires the current password. |
| Convert | PDF to text | Extracts selectable text; no OCR. |

## Still to implement

| Area | Tools found in the reference apps | Main engineering need |
| --- | --- | --- |
| Page workflows | Split by bookmark, size, text, and half; alternating merge; N-up; flip; resize; grayscale; header/footer; Bates numbering; bookmarks; rename by text | Extended page composition and layout engine. |
| Editing | Add/edit PDF text and images; shapes; links; freehand markup; forms; flatten; redact; compare | PDF renderer plus visual editor; safe redaction must remove underlying content. |
| Scans and repair | Scan to PDF; OCR; deskew; repair; stronger compression | Imaging, OCR, and structure repair engines. |
| Conversion | Images/HTML/Word/PowerPoint/Excel to PDF; PDF to images/Word/PowerPoint/Excel/PDF-A; extract images | Image rendering and Office conversion engines, including Windows packaging. |
| Signatures | Draw or apply signatures, digital signing | Visual signature placement and certificate handling. |

The [Sejda PDF SDK](https://github.com/torakiki/sejda) exposes an AGPL licensed subset; the full Sejda product is proprietary. pdfmerge implements its own workflows and does not bundle Sejda or iLovePDF code.
