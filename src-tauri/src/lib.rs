use lopdf::{dictionary, Document, Object};
use serde::Serialize;
use std::path::{Path, PathBuf};

mod engine;
mod pdf_ops;

#[derive(Serialize)]
struct PdfInfo {
    path: String,
    name: String,
    pages: usize,
    encrypted: bool,
}

fn read_pdf(path: &Path) -> Result<Document, String> {
    let doc =
        Document::load(path).map_err(|e| format!("Could not read {}: {e}", path.display()))?;
    if doc.is_encrypted() {
        return Err(format!(
            "{} is password protected. Unlock it before merging.",
            path.display()
        ));
    }
    if doc.get_pages().is_empty() {
        return Err(format!("{} has no pages.", path.display()));
    }
    Ok(doc)
}

#[tauri::command]
fn inspect_pdfs(paths: Vec<String>, allow_encrypted: Option<bool>) -> Result<Vec<PdfInfo>, String> {
    paths
        .into_iter()
        .map(|path| {
            let file = Path::new(&path);
            let doc = if allow_encrypted.unwrap_or(false) {
                Document::load(file)
                    .map_err(|e| format!("Could not read {}: {e}", file.display()))?
            } else {
                read_pdf(file)?
            };
            Ok(PdfInfo {
                name: file
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                path,
                pages: doc.get_pages().len(),
                encrypted: doc.is_encrypted(),
            })
        })
        .collect()
}

fn merge_pdfs(paths: &[PathBuf], output: &Path) -> Result<usize, String> {
    if paths.len() < 2 {
        return Err("Add at least two PDF files.".into());
    }
    if output.exists() {
        return Err("The output file already exists. Choose a new file name.".into());
    }
    let parent = output.parent().ok_or("Choose a valid output location.")?;
    let mut result = Document::with_version("1.7");
    let root_pages_id = result.new_object_id();
    let mut kids = Vec::new();
    let mut page_count = 0usize;

    for path in paths {
        let mut doc = read_pdf(path)?;
        let count = doc.get_pages().len();
        // Keep the original page trees, including inherited page properties.
        doc.renumber_objects_with(result.max_id + 1);
        let catalog_id = doc
            .trailer
            .get(b"Root")
            .and_then(Object::as_reference)
            .map_err(|_| format!("{} has no valid catalog.", path.display()))?;
        let input_pages_id = doc
            .get_object(catalog_id)
            .and_then(Object::as_dict)
            .and_then(|catalog| catalog.get(b"Pages"))
            .and_then(Object::as_reference)
            .map_err(|_| format!("{} has no valid page tree.", path.display()))?;
        doc.get_object_mut(input_pages_id)
            .and_then(Object::as_dict_mut)
            .map_err(|_| format!("{} has no valid page tree.", path.display()))?
            .set("Parent", root_pages_id);
        kids.push(Object::Reference(input_pages_id));
        page_count += count;
        result.max_id = doc.max_id;
        result.objects.extend(doc.objects);
    }

    result.objects.insert(
        root_pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => page_count as i64,
        }),
    );
    let catalog_id = result.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => root_pages_id,
    });
    result.trailer.set("Root", catalog_id);
    let temporary = tempfile::Builder::new()
        .prefix(".pdfmerge-")
        .suffix(".pdf")
        .tempfile_in(parent)
        .map_err(|e| format!("Could not create output: {e}"))?;
    let temp_path = temporary.into_temp_path();
    result
        .save(&temp_path)
        .map_err(|e| format!("Could not save merged PDF: {e}"))?;
    temp_path
        .persist_noclobber(output)
        .map_err(|e| format!("Could not save output: {e}"))?;
    Ok(page_count)
}

#[tauri::command]
async fn merge_files(paths: Vec<String>, output: String) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
        merge_pdfs(&paths, Path::new(&output))
    })
    .await
    .map_err(|e| format!("Merge task failed: {e}"))?
}

#[tauri::command]
async fn run_pdf_tool(request: pdf_ops::ToolRequest) -> Result<pdf_ops::ToolOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || pdf_ops::run(request))
        .await
        .map_err(|e| format!("PDF task failed: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_pdfs,
            merge_files,
            run_pdf_tool,
            engine::run_engine
        ])
        .run(tauri::generate_context!())
        .expect("error while running pdfmerge");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_pdf(path: &Path, pages: usize) {
        let mut doc = Document::with_version("1.4");
        let root = doc.new_object_id();
        let ids: Vec<_> = (0..pages)
            .map(|_| {
                doc.add_object(dictionary! {
                    "Type" => "Page", "Parent" => root,
                    "MediaBox" => vec![0.into(), 0.into(), 300.into(), 400.into()],
                    "Resources" => dictionary! {},
                })
            })
            .collect();
        doc.objects.insert(root, Object::Dictionary(dictionary! {
            "Type" => "Pages", "Kids" => ids.into_iter().map(Object::Reference).collect::<Vec<_>>(),
            "Count" => pages as i64,
        }));
        let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => root });
        doc.trailer.set("Root", catalog);
        doc.save(path).unwrap();
    }

    #[test]
    fn merges_pages_from_both_inputs() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.pdf");
        let b = dir.path().join("b.pdf");
        let out = dir.path().join("out.pdf");
        sample_pdf(&a, 1);
        sample_pdf(&b, 2);
        assert_eq!(merge_pdfs(&[a, b], &out).unwrap(), 3);
        assert_eq!(Document::load(&out).unwrap().get_pages().len(), 3);
    }

    #[test]
    fn never_overwrites_existing_output() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.pdf");
        let out = dir.path().join("out.pdf");
        sample_pdf(&a, 1);
        std::fs::write(&out, b"keep").unwrap();
        assert!(merge_pdfs(&[a.clone(), a], &out).is_err());
        assert_eq!(std::fs::read(out).unwrap(), b"keep");
    }
}
