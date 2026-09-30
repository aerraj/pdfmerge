use serde_json::Value;
use std::io::Write;
use std::process::{Command, Stdio};
use tauri::Manager;

#[tauri::command]
pub async fn run_engine(app: tauri::AppHandle, request: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
        let executable = resources.join("engine").join(if cfg!(windows) {
            "pdfmerge-engine.exe"
        } else {
            "pdfmerge-engine"
        });
        let mut command = if executable.is_file() {
            Command::new(executable)
        } else if cfg!(debug_assertions) {
            let python = std::env::var("PDFMERGE_PYTHON").unwrap_or_else(|_| {
                if cfg!(windows) {
                    "python".into()
                } else {
                    "python3".into()
                }
            });
            let mut c = Command::new(python);
            c.arg(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../engine/main.py"));
            c
        } else {
            return Err(
                "The PDF engine is missing. Reinstall the full app package.".to_string(),
            );
        };
        command.env("PDFMERGE_RESOURCES", resources.join("engines"));
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("Could not start the PDF engine: {e}"))?;
        let payload = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(&payload).map_err(|e| e.to_string())?;
        }
        let output = child.wait_with_output().map_err(|e| e.to_string())?;
        let response: Value = serde_json::from_slice(&output.stdout)
            .map_err(|_| format!("The PDF engine stopped unexpectedly ({}).", output.status))?;
        if response["ok"].as_bool() == Some(true) {
            Ok(response["result"].clone())
        } else {
            Err(response["error"]
                .as_str()
                .unwrap_or("PDF processing failed.")
                .to_string())
        }
    })
    .await
    .map_err(|e| format!("PDF task failed: {e}"))?
}
