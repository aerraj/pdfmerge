# Feature comparison — pdfmerge 0.3.0

The reference inventory comes from [iLovePDF Desktop](https://www.ilovepdf.com/desktop), [Sejda](https://www.sejda.com/) and [Sejda Desktop](https://www.sejda.com/desktop). All categories from the original implementation map now have local implementations. This describes their actual scope; it does not claim identical behavior or conversion fidelity to those products.

| Requested feature | Where to find it | Implementation and limits |
| --- | --- | --- |
| Add and edit text | Edit PDF → Select / Text | Select an original text object to replace or delete it, or place new text. Replacement removes the original object. Uses a bundled font; complex typography and paragraph reflow are not preserved. |
| Add and edit images | Edit PDF → Select / Image | Replace or delete original image objects; add, move and resize images. |
| Shapes, links and freehand markup | Edit PDF toolbar | Rectangles, ellipses, lines, freehand paths and HTTP/HTTPS/email links. |
| Draw or apply signatures | Sign PDF; Edit PDF → Signature / Image | Draw a signature or import a signature image, place it on a chosen page, move and resize it. This is a visual signature. |
| Digital signing | Certificate signing | Cryptographic PDF signature using a user supplied PFX/P12 certificate and its password. Existing document bytes are retained through incremental signing. Certificate trust depends on issuer; no remote timestamp service is configured. |
| Forms | Edit PDF → Text field / Checkbox; Fill PDF forms | Create fields and fill existing interactive fields. XFA forms are not supported. |
| Flatten | Flatten PDF | Render forms and annotations into image pages. Removes editable/searchable text and interactivity. |
| Redact | Redact PDF or editor toolbar | Draw redaction rectangles. The entire output is rebuilt as image pages, removing original text, layers, attachments and metadata. Redacted areas are burned into pixels. |
| Compare | Compare PDFs | Produce a visual side-by-side PDF report with changed pixels highlighted. No semantic text diff. |
| Merge, alternate and mix | Organize | Sequential merge and alternating pages from multiple PDFs. |
| Split by page count, bookmarks, size, text or half | Organize | Boundary splitting, size-targeted groups, text-matching page boundaries and two halves per page. A single page may exceed a size target. |
| Extract, remove, reorder, rotate | Organize | Page ranges, complete page sequences and 90-degree rotations. |
| N-up | Multiple pages per sheet | 2, 4, 6 or 9 pages arranged per sheet. |
| Flip and resize | Organize | Horizontal/vertical mirror; fit content to A4, Letter or A3. |
| Grayscale | Optimize & scan | Grayscale rendered image pages. |
| Header/footer, page numbers and Bates numbering | Page details | Text labels with page counters, standard page numbering and prefixed six-digit Bates numbers. |
| Bookmarks and rename by text | Organize | Add bookmarks using page/title entries; export individual pages named from their first text line. |
| Crop, watermark, metadata, remove annotations | Page details | Existing tools retained. Cropping changes visible bounds; it does not securely erase content. |
| Scan to PDF | Scan to PDF | Windows WIA acquisition dialog captures a scanner page. Requires compatible connected hardware. Multiple scans can be combined with Merge PDF. |
| OCR | OCR searchable PDF | Bundled Tesseract with English and Hindi models. Creates image pages with a searchable text layer. |
| Deskew | Straighten scans | Detect small skew angles and rotate rendered pages. Pages without reliable line evidence remain unchanged. |
| Repair | Repair PDF | Recover parseable pages and rebuild the PDF structure. Missing/corrupt content cannot always be recovered. |
| Stronger compression | Compress PDF | Three image compression presets, downsampling, stream compression and duplicate removal. Text remains selectable. If output grows, the original bytes are saved instead. |
| Images to PDF | Convert | JPEG, PNG, TIFF, BMP and WebP input, including multiple frames. |
| HTML to PDF | Convert | Local HTML through bundled LibreOffice. Complex CSS/JavaScript websites are not rendered like a browser. |
| Word/PowerPoint/Excel to PDF | Office to PDF | Bundled LibreOffice processes DOC/DOCX, PPT/PPTX, XLS/XLSX and OpenDocument files. No separate Office installation required. |
| PDF to Word | Convert | Editable extracted text and illustrations; scanned pages remain images until OCR is run. Document layout is reconstructed. |
| PDF to Excel | Convert | Inferred tables, one sheet per PDF page, with extracted text fallback. Values are saved as data, not executable formulas. |
| PDF to PowerPoint | Convert | One slide per page, editable text with detected font family/color over original graphics. Font substitution and layout differences can occur. |
| PDF to images / extract images | Convert | PNG/JPEG page rendering at chosen resolution; embedded image extraction. |
| PDF to PDF/A | Convert | LibreOffice PDF/A-2b export. Complex imports may change appearance; validate archival conformance independently when required. |
| PDF to text | Convert | Selectable text extraction. |
| Protect / unlock | Security | AES-128 open-password protection; unlocking with a known password. |

## Verification

Automated tests check original text removal, image deletion, redaction without hidden text, form creation and filling, visual signature embedding, links, certificate signature integrity, page operations, compression size and text retention, editable Office outputs, comparison, image conversion, deskew and output overwrite protection.

Windows release gates execute the packaged engine, render a page, export Word/Excel/PowerPoint and convert each back to PDF with bundled LibreOffice, run OCR, convert HTML, and check PDF/A export metadata. Hardware scanning cannot be tested without a connected WIA scanner. The installer is unsigned.

Files are processed locally. Output files never replace existing files. Editing a digitally signed PDF can invalidate its existing signatures. Large scans and multi-page image operations can require substantial memory.
