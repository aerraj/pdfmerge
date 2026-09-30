import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./App.css";

type PdfInfo = { path: string; name: string; pages: number; encrypted: boolean };
type Tool = {
  id: string;
  name: string;
  description: string;
  group: string;
  action: string;
  kind?: "text" | "folder";
};
type Outcome = { message: string; outputs: string[] };

const tools: Tool[] = [
  { id: "merge", name: "Merge PDF", description: "Combine PDFs in the order you choose.", group: "Organize", action: "Merge PDFs" },
  { id: "split", name: "Split into pages", description: "Save every page as its own PDF.", group: "Organize", action: "Split PDF", kind: "folder" },
  { id: "extract", name: "Extract pages", description: "Keep selected pages in a new PDF.", group: "Organize", action: "Extract pages" },
  { id: "remove", name: "Remove pages", description: "Delete selected pages from a copy.", group: "Organize", action: "Remove pages" },
  { id: "reorder", name: "Reorder pages", description: "Set a new page sequence.", group: "Organize", action: "Reorder pages" },
  { id: "rotate", name: "Rotate pages", description: "Rotate all or selected pages.", group: "Organize", action: "Rotate pages" },
  { id: "crop", name: "Crop pages", description: "Trim the visible area of every page.", group: "Edit", action: "Crop PDF" },
  { id: "page_numbers", name: "Page numbers", description: "Add numbers to the bottom of each page.", group: "Edit", action: "Add page numbers" },
  { id: "watermark", name: "Text watermark", description: "Place a light text watermark on each page.", group: "Edit", action: "Add watermark" },
  { id: "remove_annotations", name: "Remove annotations", description: "Clear comments and markup.", group: "Edit", action: "Remove annotations" },
  { id: "metadata", name: "Edit metadata", description: "Set title, author, subject, and keywords.", group: "Edit", action: "Save metadata" },
  { id: "optimize", name: "Optimize PDF", description: "Repack the PDF without reducing image quality.", group: "Optimize", action: "Optimize PDF" },
  { id: "protect", name: "Protect PDF", description: "Require a password to open this PDF.", group: "Security", action: "Protect PDF" },
  { id: "unlock", name: "Unlock PDF", description: "Remove a password you know from a PDF.", group: "Security", action: "Unlock PDF" },
  { id: "text", name: "PDF to text", description: "Extract selectable text from a PDF.", group: "Convert", action: "Extract text", kind: "text" },
];

function App() {
  const [selectedTool, setSelectedTool] = useState("merge");
  const [files, setFiles] = useState<PdfInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pages, setPages] = useState("");
  const [order, setOrder] = useState("");
  const [rotation, setRotation] = useState(90);
  const [margin, setMargin] = useState(18);
  const [watermark, setWatermark] = useState("");
  const [password, setPassword] = useState("");
  const [metadata, setMetadata] = useState({ title: "", author: "", subject: "", keywords: "" });
  const tool = tools.find(item => item.id === selectedTool)!;

  function selectTool(id: string) {
    setSelectedTool(id);
    setFiles([]);
    setPages("");
    setOrder("");
    setPassword("");
    setError("");
    setMessage("");
  }

  async function addFiles() {
    setError("");
    try {
      const selected = await open({ multiple: tool.id === "merge", filters: [{ name: "PDF documents", extensions: ["pdf"] }] });
      if (!selected) return;
      const paths = (Array.isArray(selected) ? selected : [selected]).filter(path => !files.some(file => file.path === path));
      if (!paths.length) return;
      setBusy(true);
      const details = await invoke<PdfInfo[]>("inspect_pdfs", { paths, allowEncrypted: tool.id === "unlock" });
      setFiles(previous => tool.id === "merge" ? [...previous, ...details] : details.slice(0, 1));
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
  }

  async function chooseOutput(): Promise<string | null> {
    if (tool.kind === "folder") {
      const chosen = await open({ directory: true, multiple: false });
      return typeof chosen === "string" ? chosen : null;
    }
    const stem = files[0]?.name.replace(/\.pdf$/i, "") || "document";
    const extension = tool.kind === "text" ? "txt" : "pdf";
    return await save({
      defaultPath: `${stem}-${tool.id}.${extension}`,
      filters: [{ name: extension === "txt" ? "Text file" : "PDF document", extensions: [extension] }],
    });
  }

  async function runTool() {
    setError("");
    setMessage("");
    try {
      const output = await chooseOutput();
      if (!output) return;
      setBusy(true);
      if (tool.id === "merge") {
        const count = await invoke<number>("merge_files", { paths: files.map(file => file.path), output });
        setMessage(`Merged ${count} pages into ${output}`);
      } else {
        const result = await invoke<Outcome>("run_pdf_tool", { request: {
          tool: tool.id,
          input: files[0].path,
          output,
          pages,
          order,
          rotation,
          margin,
          text: watermark,
          password,
          ...metadata,
        }});
        setMessage(`${result.message} ${result.outputs.length === 1 ? result.outputs[0] : `${result.outputs.length} files in ${output}`}`);
      }
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  const totalPages = files.reduce((sum, file) => sum + file.pages, 0);
  const canRun = !busy && (tool.id === "merge" ? files.length >= 2 : files.length === 1);

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">P</span><span>pdfmerge</span></div><span className="local-badge"><span className="status-dot" /> Local PDF tools</span></header>
      <div className="layout">
        <aside className="tool-sidebar" aria-label="PDF tools">
          <h1>Tools</h1>
          {Array.from(new Set(tools.map(item => item.group))).map(group => (
            <div className="tool-group" key={group}>
              <h2>{group}</h2>
              {tools.filter(item => item.group === group).map(item => (
                <button key={item.id} className={`tool-choice ${selectedTool === item.id ? "selected" : ""}`} onClick={() => selectTool(item.id)} aria-current={selectedTool === item.id ? "page" : undefined}>{item.name}</button>
              ))}
            </div>
          ))}
        </aside>
        <section className="workspace" aria-labelledby="tool-title">
          <div className="workspace-head"><span className="eyebrow">{tool.group.toUpperCase()} PDF</span><h2 id="tool-title">{tool.name}</h2><p>{tool.description}</p></div>
          <div className="workspace-body">
            <div className="section-title"><div><h3>{tool.id === "merge" ? "Your documents" : "Your document"}</h3><p>{files.length ? tool.id === "unlock" ? "Password protected PDF" : `${files.length} ${files.length === 1 ? "file" : "files"} · ${totalPages} ${totalPages === 1 ? "page" : "pages"}` : "Choose a PDF from your computer"}</p></div><button className="secondary-button" onClick={addFiles} disabled={busy}>{tool.id === "merge" ? "+ Add PDFs" : files.length ? "Change PDF" : "+ Choose PDF"}</button></div>
            {files.length === 0 ? <button className="empty-state" onClick={addFiles} disabled={busy}><span className="document-icon">PDF</span><strong>Choose {tool.id === "merge" ? "your PDF files" : "a PDF file"}</strong><span>Files are processed on your computer.</span></button> : (
              <ol className="file-list">{files.map((file, index) => <li key={file.path} className="file-row"><span className="file-position">{String(index + 1).padStart(2, "0")}</span><span className="mini-document">PDF</span><span className="file-description"><strong title={file.name}>{file.name}</strong><small>{file.encrypted ? "Password protected" : `${file.pages} ${file.pages === 1 ? "page" : "pages"}`}</small></span>{tool.id === "merge" && <div className="row-actions"><button aria-label={`Move ${file.name} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button><button aria-label={`Move ${file.name} down`} disabled={busy || index === files.length - 1} onClick={() => move(index, 1)}>↓</button><button aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => setFiles(files.filter((_, i) => i !== index))}>×</button></div>}</li>)}</ol>
            )}

            {files.length > 0 && tool.id !== "merge" && <div className="options">
              {(tool.id === "extract" || tool.id === "remove" || tool.id === "rotate") && <label>Pages {tool.id === "rotate" && <span className="optional">(leave blank for all pages)</span>}<input value={pages} onChange={event => setPages(event.target.value)} placeholder="e.g. 1-3, 5" /><small>Use commas and ranges. Page numbers start at 1.</small></label>}
              {tool.id === "reorder" && <label>New page order<input value={order} onChange={event => setOrder(event.target.value)} placeholder={`e.g. ${files[0].pages >= 3 ? "3, 1, 2" : "2, 1"}`} /><small>List every page exactly once.</small></label>}
              {tool.id === "rotate" && <label>Rotation<select value={rotation} onChange={event => setRotation(Number(event.target.value))}><option value={90}>90° clockwise</option><option value={180}>180°</option><option value={270}>90° counterclockwise</option></select></label>}
              {tool.id === "crop" && <label>Margin from each edge (points)<input type="number" min="0" max="500" step="1" value={margin} onChange={event => setMargin(Number(event.target.value))} /><small>72 points = 1 inch. This adjusts the visible page area.</small></label>}
              {tool.id === "watermark" && <label>Watermark text<input value={watermark} maxLength={80} onChange={event => setWatermark(event.target.value)} placeholder="CONFIDENTIAL" /><small>Basic Latin characters only.</small></label>}
              {(tool.id === "protect" || tool.id === "unlock") && <label>PDF password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="off" placeholder={tool.id === "protect" ? "Choose a password" : "Enter the current password"} /><small>{tool.id === "protect" ? "Keep this password somewhere safe. Losing it may make the PDF inaccessible." : "You must know the current password."}</small></label>}
              {tool.id === "metadata" && <div className="metadata-grid">{(["title", "author", "subject", "keywords"] as const).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input value={metadata[key]} onChange={event => setMetadata({ ...metadata, [key]: event.target.value })} /></label>)}</div>}
              {tool.id === "optimize" && <p className="tool-note">Lossless repacking keeps image quality. Some PDFs will not get smaller.</p>}
              {tool.id === "text" && <p className="tool-note">Extracts selectable text. Scanned pages need OCR, which is not included yet.</p>}
              {tool.id === "split" && <p className="tool-note">Choose an output folder; one PDF will be saved for each page.</p>}
            </div>}
          </div>
          <div className="workspace-footer"><span>Original files stay unchanged.</span><button className="primary-button" onClick={runTool} disabled={!canRun}>{busy ? "Working…" : `${tool.action} →`}</button></div>
          {error && <p className="notice error" role="alert">{error}</p>}
          {message && <p className="notice success" role="status">{message}</p>}
        </section>
      </div>
    </main>
  );
}

export default App;
