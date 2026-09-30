use lopdf::content::{Content, Operation};
use lopdf::{
    dictionary, Dictionary, Document, EncryptionState, EncryptionVersion, LoadOptions, Object,
    ObjectId, Permissions, StringFormat,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRequest {
    pub tool: String,
    pub input: String,
    pub output: String,
    pub pages: Option<String>,
    pub order: Option<String>,
    pub rotation: Option<i64>,
    pub margin: Option<f32>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub text: Option<String>,
    pub password: Option<String>,
}

#[derive(Serialize)]
pub struct ToolOutcome {
    pub message: String,
    pub outputs: Vec<String>,
}

fn load(path: &Path) -> Result<Document, String> {
    let doc =
        Document::load(path).map_err(|e| format!("Could not open {}: {e}", path.display()))?;
    if doc.is_encrypted() {
        return Err("This PDF is password protected. Unlock it before using this tool.".into());
    }
    if doc.get_pages().is_empty() {
        return Err("This PDF has no pages.".into());
    }
    Ok(doc)
}

fn parse_pages(value: &str, count: usize) -> Result<Vec<u32>, String> {
    let mut result = Vec::new();
    for item in value.split(',').map(str::trim).filter(|s| !s.is_empty()) {
        if let Some((start, end)) = item.split_once('-') {
            let start: u32 = start
                .trim()
                .parse()
                .map_err(|_| "Enter pages like 1-3, 5.".to_string())?;
            let end: u32 = end
                .trim()
                .parse()
                .map_err(|_| "Enter pages like 1-3, 5.".to_string())?;
            if start == 0 || start > end || end as usize > count {
                return Err(format!("Page range must be within 1-{count}."));
            }
            result.extend(start..=end);
        } else {
            let page: u32 = item
                .parse()
                .map_err(|_| "Enter pages like 1-3, 5.".to_string())?;
            if page == 0 || page as usize > count {
                return Err(format!("Page number must be within 1-{count}."));
            }
            result.push(page);
        }
    }
    if result.is_empty() {
        return Err("Enter at least one page number.".into());
    }
    if result.len() > count || {
        let mut unique = result.clone();
        unique.sort_unstable();
        unique.dedup();
        unique.len() != result.len()
    } {
        return Err("Each page can appear only once.".into());
    }
    Ok(result)
}

fn inherited(doc: &Document, page_id: ObjectId, key: &[u8]) -> Option<Object> {
    let mut current = page_id;
    for _ in 0..64 {
        let dict = doc.get_object(current).ok()?.as_dict().ok()?;
        if let Ok(value) = dict.get(key) {
            return Some(value.clone());
        }
        current = dict.get(b"Parent").ok()?.as_reference().ok()?;
    }
    None
}

fn select_pages(doc: &mut Document, sequence: &[u32]) -> Result<(), String> {
    let original = doc.get_pages();
    let all_pages = sequence.len() == original.len();
    let page_ids: Vec<ObjectId> = sequence
        .iter()
        .map(|n| {
            original
                .get(n)
                .copied()
                .ok_or_else(|| format!("Page {n} does not exist."))
        })
        .collect::<Result<_, _>>()?;
    let root_id = doc.new_object_id();
    for page_id in &page_ids {
        let attrs: Vec<(&[u8], Object)> =
            [b"Resources".as_slice(), b"MediaBox", b"CropBox", b"Rotate"]
                .iter()
                .filter_map(|key| inherited(doc, *page_id, key).map(|v| (*key, v)))
                .collect();
        let page = doc
            .get_object_mut(*page_id)
            .and_then(Object::as_dict_mut)
            .map_err(|_| "A selected page is invalid.".to_string())?;
        for (key, value) in attrs {
            if page.get(key).is_err() {
                page.set(key, value);
            }
        }
        page.set("Parent", root_id);
    }
    doc.objects.insert(
        root_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
            "Count" => page_ids.len() as i64,
        }),
    );
    let catalog_id = doc
        .trailer
        .get(b"Root")
        .and_then(Object::as_reference)
        .map_err(|_| "PDF catalog is invalid.".to_string())?;
    let catalog = doc
        .get_object_mut(catalog_id)
        .and_then(Object::as_dict_mut)
        .map_err(|_| "PDF catalog is invalid.".to_string())?;
    catalog.set("Pages", root_id);
    if !all_pages {
        catalog.remove(b"Outlines");
        catalog.remove(b"AcroForm");
    }
    doc.prune_objects();
    Ok(())
}

fn save_pdf(doc: &mut Document, output: &Path, modern: bool) -> Result<(), String> {
    if output.exists() {
        return Err("The output already exists. Choose a new filename.".into());
    }
    let parent = output.parent().ok_or("Choose a valid output location.")?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".pdfmerge-")
        .suffix(".pdf")
        .tempfile_in(parent)
        .map_err(|e| format!("Could not create output: {e}"))?;
    if modern {
        doc.save_modern(temporary.as_file_mut())
    } else {
        doc.save_to(temporary.as_file_mut())
    }
    .map_err(|e| format!("Could not save PDF: {e}"))?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|e| format!("Could not finish output: {e}"))?;
    temporary
        .persist_noclobber(output)
        .map_err(|e| format!("Could not save output: {e}"))?;
    Ok(())
}

fn save_text(text: &str, output: &Path) -> Result<(), String> {
    if output.exists() {
        return Err("The output already exists. Choose a new filename.".into());
    }
    let parent = output.parent().ok_or("Choose a valid output location.")?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".pdfmerge-")
        .suffix(".txt")
        .tempfile_in(parent)
        .map_err(|e| format!("Could not create output: {e}"))?;
    use std::io::Write;
    temporary
        .write_all(text.as_bytes())
        .map_err(|e| format!("Could not write text: {e}"))?;
    temporary
        .persist_noclobber(output)
        .map_err(|e| format!("Could not save output: {e}"))?;
    Ok(())
}

fn as_number(obj: &Object) -> Result<f32, String> {
    match obj {
        Object::Integer(value) => Ok(*value as f32),
        Object::Real(value) => Ok(*value),
        _ => Err("This PDF has an invalid page box.".into()),
    }
}

fn page_box(doc: &Document, page_id: ObjectId) -> Result<[f32; 4], String> {
    let value = inherited(doc, page_id, b"CropBox")
        .or_else(|| inherited(doc, page_id, b"MediaBox"))
        .ok_or("A page is missing its size.")?;
    let coords = value
        .as_array()
        .map_err(|_| "A page has an invalid size.")?;
    if coords.len() != 4 {
        return Err("A page has an invalid size.".into());
    }
    Ok([
        as_number(&coords[0])?,
        as_number(&coords[1])?,
        as_number(&coords[2])?,
        as_number(&coords[3])?,
    ])
}

fn resolve_dict(doc: &Document, object: &Object) -> Result<Dictionary, String> {
    match object {
        Object::Dictionary(dict) => Ok(dict.clone()),
        Object::Reference(id) => doc
            .get_object(*id)
            .and_then(Object::as_dict)
            .map(Clone::clone)
            .map_err(|_| "A page resource is invalid.".into()),
        _ => Err("A page resource is invalid.".into()),
    }
}

fn add_text(
    doc: &mut Document,
    page_id: ObjectId,
    font_id: ObjectId,
    text: &str,
    x: f32,
    y: f32,
    size: f32,
    gray: f32,
) -> Result<(), String> {
    let mut resources = if let Some(value) = inherited(doc, page_id, b"Resources") {
        resolve_dict(doc, &value)?
    } else {
        dictionary! {}
    };
    let mut fonts = if let Ok(value) = resources.get(b"Font") {
        resolve_dict(doc, value)?
    } else {
        dictionary! {}
    };
    fonts.set("PdfMergeFont", font_id);
    resources.set("Font", fonts);
    doc.get_object_mut(page_id)
        .and_then(Object::as_dict_mut)
        .map_err(|_| "A page is invalid.".to_string())?
        .set("Resources", resources);
    let content = Content {
        operations: vec![
            Operation::new("q", vec![]),
            Operation::new("g", vec![Object::Real(gray)]),
            Operation::new("BT", vec![]),
            Operation::new(
                "Tf",
                vec![Object::Name(b"PdfMergeFont".to_vec()), Object::Real(size)],
            ),
            Operation::new(
                "Tm",
                vec![
                    1.into(),
                    0.into(),
                    0.into(),
                    1.into(),
                    Object::Real(x),
                    Object::Real(y),
                ],
            ),
            Operation::new("Tj", vec![Object::string_literal(text)]),
            Operation::new("ET", vec![]),
            Operation::new("Q", vec![]),
        ],
    };
    doc.add_to_page_content(page_id, content)
        .map_err(|e| format!("Could not write page text: {e}"))
}

pub fn run(request: ToolRequest) -> Result<ToolOutcome, String> {
    let input = PathBuf::from(&request.input);
    let output = PathBuf::from(&request.output);
    if request.tool == "unlock" {
        let password = request
            .password
            .as_deref()
            .filter(|v| !v.is_empty())
            .ok_or("Enter the PDF password.")?;
        let mut doc = Document::load_with_options(&input, LoadOptions::with_password(password))
            .map_err(|_| {
                "Could not unlock this PDF. Check the password or encryption type.".to_string()
            })?;
        if !doc.was_encrypted() {
            return Err("This PDF is not password protected.".into());
        }
        if doc.get_pages().is_empty() {
            return Err("This PDF has no pages.".into());
        }
        save_pdf(&mut doc, &output, false)?;
        return Ok(ToolOutcome {
            message: "Unlocked PDF saved.".into(),
            outputs: vec![request.output],
        });
    }
    let mut doc = load(&input)?;
    let count = doc.get_pages().len();
    let pages: Vec<u32> = (1..=count as u32).collect();
    let mut modern = false;

    match request.tool.as_str() {
        "extract" | "remove" => {
            let selected = parse_pages(request.pages.as_deref().unwrap_or(""), count)?;
            let keep = if request.tool == "extract" {
                selected
            } else {
                pages
                    .into_iter()
                    .filter(|p| !selected.contains(p))
                    .collect()
            };
            if keep.is_empty() {
                return Err("The result must contain at least one page.".into());
            }
            select_pages(&mut doc, &keep)?;
        }
        "reorder" => {
            let sequence = parse_pages(request.order.as_deref().unwrap_or(""), count)?;
            if sequence.len() != count {
                return Err(format!("Enter every page exactly once (1-{count})."));
            }
            select_pages(&mut doc, &sequence)?;
        }
        "rotate" => {
            let selected =
                if let Some(spec) = request.pages.as_deref().filter(|s| !s.trim().is_empty()) {
                    parse_pages(spec, count)?
                } else {
                    pages
                };
            let angle = request.rotation.unwrap_or(90);
            if ![90, 180, 270].contains(&angle) {
                return Err("Choose 90, 180, or 270 degrees.".into());
            }
            for n in selected {
                let id = doc.get_pages()[&n];
                let current = inherited(&doc, id, b"Rotate")
                    .and_then(|v| v.as_i64().ok())
                    .unwrap_or(0);
                doc.get_object_mut(id)
                    .and_then(Object::as_dict_mut)
                    .map_err(|_| format!("Page {n} is invalid."))?
                    .set("Rotate", (current + angle) % 360);
            }
        }
        "crop" => {
            let margin = request.margin.unwrap_or(0.0);
            if !margin.is_finite() || !(0.0..=500.0).contains(&margin) {
                return Err("Enter a margin from 0 to 500 points.".into());
            }
            for (_, id) in doc.get_pages() {
                let values = page_box(&doc, id)?;
                if values[2] - values[0] <= 2.0 * margin || values[3] - values[1] <= 2.0 * margin {
                    return Err("Margin is larger than one of the pages.".into());
                }
                let rect: Vec<Object> = vec![
                    values[0] + margin,
                    values[1] + margin,
                    values[2] - margin,
                    values[3] - margin,
                ]
                .into_iter()
                .map(Object::Real)
                .collect();
                doc.get_object_mut(id)
                    .and_then(Object::as_dict_mut)
                    .map_err(|_| "A page is invalid.")?
                    .set("CropBox", rect);
            }
        }
        "optimize" => {
            doc.compress();
            modern = true;
        }
        "protect" => {
            let password = request
                .password
                .as_deref()
                .filter(|v| !v.is_empty())
                .ok_or("Enter a password for the PDF.")?;
            if password.len() > 127 {
                return Err("Use a password shorter than 128 characters.".into());
            }
            if doc.trailer.get(b"ID").is_err() {
                let mut id = [0u8; 16];
                getrandom::fill(&mut id)
                    .map_err(|e| format!("Could not create a document ID: {e}"))?;
                doc.trailer.set(
                    "ID",
                    Object::Array(vec![
                        Object::String(id.to_vec(), StringFormat::Literal),
                        Object::String(id.to_vec(), StringFormat::Literal),
                    ]),
                );
            }
            let filter: Arc<dyn lopdf::encryption::crypt_filters::CryptFilter> =
                Arc::new(lopdf::encryption::crypt_filters::Aes128CryptFilter);
            let version = EncryptionVersion::V4 {
                document: &doc,
                encrypt_metadata: true,
                crypt_filters: BTreeMap::from([(b"StdCF".to_vec(), filter)]),
                stream_filter: b"StdCF".to_vec(),
                string_filter: b"StdCF".to_vec(),
                owner_password: password,
                user_password: password,
                permissions: Permissions::all(),
            };
            let state = EncryptionState::try_from(version)
                .map_err(|e| format!("Could not set PDF password: {e}"))?;
            doc.encrypt(&state)
                .map_err(|e| format!("Could not protect PDF: {e}"))?;
        }
        "remove_annotations" => {
            for (_, id) in doc.get_pages() {
                doc.get_object_mut(id)
                    .and_then(Object::as_dict_mut)
                    .map_err(|_| "A page is invalid.")?
                    .remove(b"Annots");
            }
            let catalog_id = doc
                .trailer
                .get(b"Root")
                .and_then(Object::as_reference)
                .map_err(|_| "PDF catalog is invalid.".to_string())?;
            doc.get_object_mut(catalog_id)
                .and_then(Object::as_dict_mut)
                .map_err(|_| "PDF catalog is invalid.".to_string())?
                .remove(b"AcroForm");
            doc.prune_objects();
        }
        "metadata" => {
            let mut info = doc
                .trailer
                .get(b"Info")
                .ok()
                .and_then(|value| resolve_dict(&doc, value).ok())
                .unwrap_or_else(|| dictionary! {});
            for (key, value) in [
                ("Title", request.title.as_deref()),
                ("Author", request.author.as_deref()),
                ("Subject", request.subject.as_deref()),
                ("Keywords", request.keywords.as_deref()),
            ] {
                if let Some(value) = value.filter(|v| !v.trim().is_empty()) {
                    info.set(key, Object::string_literal(value));
                }
            }
            let id = doc.add_object(info);
            doc.trailer.set("Info", id);
        }
        "page_numbers" | "watermark" => {
            let label = if request.tool == "watermark" {
                let value = request.text.as_deref().unwrap_or("").trim();
                if value.is_empty() || value.len() > 80 || !value.is_ascii() {
                    return Err(
                        "Enter watermark text using up to 80 basic Latin characters.".into(),
                    );
                }
                Some(value.to_string())
            } else {
                None
            };
            let font_id = doc.add_object(dictionary! {
                "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica",
            });
            for (number, id) in doc.get_pages() {
                let rect = page_box(&doc, id)?;
                if let Some(text) = &label {
                    let size = 36.0;
                    let x = (rect[0] + rect[2]) / 2.0 - text.len() as f32 * size * 0.25;
                    let y = (rect[1] + rect[3]) / 2.0;
                    add_text(&mut doc, id, font_id, text, x, y, size, 0.78)?;
                } else {
                    let text = number.to_string();
                    add_text(
                        &mut doc,
                        id,
                        font_id,
                        &text,
                        rect[2] - 45.0,
                        rect[1] + 27.0,
                        11.0,
                        0.25,
                    )?;
                }
            }
        }
        "text" => {
            let text = doc
                .extract_text_with_limit(&pages, 64 * 1024 * 1024)
                .map_err(|e| format!("Could not extract text: {e}"))?;
            save_text(&text, &output)?;
            return Ok(ToolOutcome {
                message: "Text extracted.".into(),
                outputs: vec![request.output],
            });
        }
        "split" => {
            if !output.is_dir() {
                return Err("Choose an existing output folder.".into());
            }
            let stem = input.file_stem().unwrap_or_default().to_string_lossy();
            let mut outputs = Vec::new();
            for n in &pages {
                let path = output.join(format!("{stem}-page-{n:03}.pdf"));
                if path.exists() {
                    return Err(format!("{} already exists.", path.display()));
                }
                outputs.push(path);
            }
            for (n, path) in pages.iter().zip(outputs.iter()) {
                let mut copy = doc.clone();
                select_pages(&mut copy, &[*n])?;
                save_pdf(&mut copy, path, false)?;
            }
            return Ok(ToolOutcome {
                message: format!("Created {count} PDF files."),
                outputs: outputs
                    .into_iter()
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect(),
            });
        }
        _ => return Err("Unknown PDF tool.".into()),
    }

    save_pdf(&mut doc, &output, modern)?;
    Ok(ToolOutcome {
        message: "PDF saved.".into(),
        outputs: vec![request.output],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_pdf(path: &Path) {
        let mut doc = Document::with_version("1.5");
        let root = doc.new_object_id();
        let ids: Vec<_> = (1..=3)
            .map(|page| {
                doc.add_object(dictionary! {
                    "Type" => "Page", "Parent" => root,
                    "MediaBox" => vec![0.into(), 0.into(), (page * 100).into(), 400.into()],
                    "Resources" => dictionary! {},
                })
            })
            .collect();
        doc.objects.insert(root, Object::Dictionary(dictionary! {
            "Type" => "Pages", "Kids" => ids.into_iter().map(Object::Reference).collect::<Vec<_>>(),
            "Count" => 3,
        }));
        let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => root });
        doc.trailer.set("Root", catalog);
        doc.save(path).unwrap();
    }

    fn request(tool: &str, input: &Path, output: &Path) -> ToolRequest {
        ToolRequest {
            tool: tool.into(),
            input: input.to_string_lossy().into_owned(),
            output: output.to_string_lossy().into_owned(),
            pages: None,
            order: None,
            rotation: None,
            margin: None,
            title: None,
            author: None,
            subject: None,
            keywords: None,
            text: None,
            password: None,
        }
    }

    #[test]
    fn validates_page_ranges() {
        assert_eq!(parse_pages("1-3, 5", 5).unwrap(), vec![1, 2, 3, 5]);
        assert!(parse_pages("0", 5).is_err());
        assert!(parse_pages("2,2", 5).is_err());
        assert!(parse_pages("3-2", 5).is_err());
        assert!(parse_pages("6", 5).is_err());
    }

    #[test]
    fn extracts_and_reorders_selected_pages() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("input.pdf");
        let output = dir.path().join("selected.pdf");
        sample_pdf(&input);
        let mut job = request("extract", &input, &output);
        job.pages = Some("3,1".into());
        run(job).unwrap();
        let result = Document::load(&output).unwrap();
        assert_eq!(result.get_pages().len(), 2);
        let widths: Vec<i64> = result
            .get_pages()
            .values()
            .map(|id| {
                let page = result.get_object(*id).unwrap().as_dict().unwrap();
                page.get(b"MediaBox").unwrap().as_array().unwrap()[2]
                    .as_i64()
                    .unwrap()
            })
            .collect();
        assert_eq!(widths, vec![300, 100]);
    }

    #[test]
    fn splits_into_valid_single_page_pdfs() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("input.pdf");
        sample_pdf(&input);
        let outcome = run(request("split", &input, dir.path())).unwrap();
        assert_eq!(outcome.outputs.len(), 3);
        for path in outcome.outputs {
            assert_eq!(Document::load(path).unwrap().get_pages().len(), 1);
        }
    }

    #[test]
    fn rotates_only_requested_pages() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("input.pdf");
        let output = dir.path().join("rotated.pdf");
        sample_pdf(&input);
        let mut job = request("rotate", &input, &output);
        job.pages = Some("2".into());
        job.rotation = Some(90);
        run(job).unwrap();
        let result = Document::load(output).unwrap();
        let pages = result.get_pages();
        assert!(result
            .get_object(pages[&1])
            .unwrap()
            .as_dict()
            .unwrap()
            .get(b"Rotate")
            .is_err());
        assert_eq!(
            result
                .get_object(pages[&2])
                .unwrap()
                .as_dict()
                .unwrap()
                .get(b"Rotate")
                .unwrap()
                .as_i64()
                .unwrap(),
            90
        );
    }

    #[test]
    fn writes_watermark_and_page_numbers() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("input.pdf");
        let marked = dir.path().join("marked.pdf");
        let numbered = dir.path().join("numbered.pdf");
        sample_pdf(&input);
        let mut watermark = request("watermark", &input, &marked);
        watermark.text = Some("DRAFT".into());
        run(watermark).unwrap();
        let marked_doc = Document::load(marked).unwrap();
        assert!(marked_doc.extract_text(&[1]).unwrap().contains("DRAFT"));
        run(request("page_numbers", &input, &numbered)).unwrap();
        let numbered_doc = Document::load(numbered).unwrap();
        assert!(numbered_doc.extract_text(&[3]).unwrap().contains('3'));
    }

    #[test]
    fn protects_and_unlocks_with_password() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("input.pdf");
        let protected = dir.path().join("protected.pdf");
        let unlocked = dir.path().join("unlocked.pdf");
        sample_pdf(&input);
        let mut protect = request("protect", &input, &protected);
        protect.password = Some("secret passphrase".into());
        run(protect).unwrap();
        assert!(Document::load(&protected).unwrap().is_encrypted());
        let mut unlock = request("unlock", &protected, &unlocked);
        unlock.password = Some("wrong".into());
        assert!(run(unlock).is_err());
        let mut unlock = request("unlock", &protected, &unlocked);
        unlock.password = Some("secret passphrase".into());
        run(unlock).unwrap();
        let result = Document::load(unlocked).unwrap();
        assert!(!result.is_encrypted());
        assert_eq!(result.get_pages().len(), 3);
    }
}
