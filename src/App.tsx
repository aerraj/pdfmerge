import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./App.css";

type PdfInfo = { path: string; name: string; pages: number };

function App() {
  const [files, setFiles] = useState<PdfInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function addFiles() {
    setError("");
    try {
      const selected = await open({ multiple: true, filters: [{ name: "PDF documents", extensions: ["pdf"] }] });
      if (!selected) return;
      const paths = (Array.isArray(selected) ? selected : [selected]).filter(path => !files.some(file => file.path === path));
      if (!paths.length) return;
      setBusy(true);
      const details = await invoke<PdfInfo[]>("inspect_pdfs", { paths });
      setFiles(previous => [...previous, ...details]);
      setMessage("");
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, step: number) {
    const next = [...files];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setFiles(next);
    setMessage("");
  }

  async function merge() {
    setError("");
    setMessage("");
    try {
      const output = await save({ defaultPath: "merged.pdf", filters: [{ name: "PDF document", extensions: ["pdf"] }] });
      if (!output) return;
      setBusy(true);
      const pages = await invoke<number>("merge_files", { paths: files.map(file => file.path), output });
      setMessage(`Done — ${pages} pages saved to ${output}`);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  const totalPages = files.reduce((sum, file) => sum + file.pages, 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">P</span><span>pdfmerge</span></div>
        <span className="local-badge"><span className="status-dot" />Works locally on your computer</span>
      </header>

      <div className="content">
        <div className="eyebrow">PDF TOOL · WINDOWS</div>
        <h1>One PDF.<br /><em>All your pages.</em></h1>
        <p className="intro">Combine documents in the exact order you want. Your files stay on your device.</p>

        <section className="workspace" aria-label="PDF merge workspace">
          <div className="workspace-header">
            <div><h2>Your documents</h2><p>{files.length ? `${files.length} files · ${totalPages} pages` : "Add two or more PDFs to get started"}</p></div>
            <button className="secondary-button" onClick={addFiles} disabled={busy}>+ Add PDFs</button>
          </div>

          {files.length === 0 ? (
            <button className="empty-state" onClick={addFiles} disabled={busy}>
              <span className="document-icon">PDF</span>
              <strong>Choose your PDF files</strong>
              <span>Select multiple files, then arrange them in order.</span>
            </button>
          ) : (
            <ol className="file-list">
              {files.map((file, index) => (
                <li key={file.path} className="file-row">
                  <span className="file-position">{String(index + 1).padStart(2, "0")}</span>
                  <span className="mini-document">PDF</span>
                  <span className="file-description"><strong title={file.name}>{file.name}</strong><small>{file.pages} {file.pages === 1 ? "page" : "pages"}</small></span>
                  <div className="row-actions">
                    <button aria-label={`Move ${file.name} up`} title="Move up" disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button>
                    <button aria-label={`Move ${file.name} down`} title="Move down" disabled={busy || index === files.length - 1} onClick={() => move(index, 1)}>↓</button>
                    <button aria-label={`Remove ${file.name}`} title="Remove" disabled={busy} onClick={() => setFiles(files.filter((_, i) => i !== index))}>×</button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="workspace-footer">
            <span>Pages follow the order shown above.</span>
            <button className="primary-button" onClick={merge} disabled={busy || files.length < 2}>{busy ? "Working…" : "Merge PDFs →"}</button>
          </div>
        </section>

        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice success" role="status">{message}</p>}
        <p className="footnote">No account, upload, or subscription required.</p>
      </div>
    </main>
  );
}

export default App;
