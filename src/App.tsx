import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save, confirm } from "@tauri-apps/plugin-dialog";
import { tools, type Tool } from "./tools";
import PdfEditor from "./PdfEditor";
import "./App.css";

type Result={message:string;outputs:string[]};
type Field={name:string;type:string;value:string;options:string[]};
const fileName=(path:string)=>path.split(/[\\/]/).pop()||path;

export default function App(){
 const [toolId,setToolId]=useState("edit");
 const [query,setQuery]=useState("");
 const [files,setFiles]=useState<string[]>([]);
 const [params,setParams]=useState<Record<string,string|number>>({});
 const [busy,setBusy]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [certificate,setCertificate]=useState("");
 const [fields,setFields]=useState<Field[]>([]);
 const [values,setValues]=useState<Record<string,string>>({});
 const tool=tools.find(t=>t.id===toolId)!;
 const isEditor=["edit","sign","redact"].includes(tool.id);
 async function selectTool(t:Tool){
  if(dirty&&!await confirm("Discard the unsaved PDF edits?",{title:"Unsaved edits",kind:"warning"}))return;
  setDirty(false);
  setToolId(t.id);setFiles([]);setError("");setMessage("");setCertificate("");setFields([]);setValues({});
  setParams(Object.fromEntries((t.params||[]).map(p=>[p.key,p.value??""])));
 }
 async function addFiles(){
  if(dirty&&!await confirm("Discard the unsaved PDF edits and choose another file?",{title:"Unsaved edits",kind:"warning"}))return;
  setError("");setBusy(true);
  try{
   const chosen=await open({multiple:tool.multi||false,filters:[{name:tool.extensions?"Supported files":"PDF documents",extensions:tool.extensions||["pdf"]}]});
   if(!chosen)return;
   const paths:string[]=typeof chosen==="string"?[chosen]:chosen;
   const next=tool.multi?Array.from(new Set([...files,...paths])):paths.slice(0,1);
   setFiles(next);setMessage("");
   if(tool.id==="fill_forms"){
    const result=await invoke<{fields:Field[]}>("run_engine",{request:{tool:"form_fields",inputs:next}});
    setFields(result.fields);setValues(Object.fromEntries(result.fields.map(f=>[f.name,f.value])));
   }
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function run(){
  setError("");setMessage("");setBusy(true);
  try{
   const ext=tool.output||"pdf";
   const stem=files[0]?fileName(files[0]).replace(/\.[^.]+$/,""):"scan";
   const chosen=ext==="folder"?await open({directory:true,multiple:false}):await save({defaultPath:stem+"-"+tool.id+"."+ext,filters:[{name:ext.toUpperCase(),extensions:[ext]}]});
   if(typeof chosen!=="string")return;
   if(tool.id==="merge"){
    const count=await invoke<number>("merge_files",{paths:files,output:chosen});setMessage(`Merged ${count} pages. ${chosen}`);
   }else if(tool.engine){
    const result=await invoke<Result>("run_engine",{request:{tool:tool.id,inputs:files,output:chosen,...params,page:Math.max(0,Number(params.page||1)-1),certificate,values}});
    setMessage(result.message+" "+(result.outputs.length===1?result.outputs[0]:`${result.outputs.length} files in ${chosen}`));
   }else{
    const result=await invoke<Result>("run_pdf_tool",{request:{tool:tool.id,input:files[0],output:chosen,...params,rotation:Number(params.rotation||90),margin:Number(params.margin||0)}});
    setMessage(result.message+" "+(result.outputs.length===1?result.outputs[0]:chosen));
   }
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 function move(index:number,step:number){setFiles(old=>{const next=[...old];[next[index],next[index+step]]=[next[index+step],next[index]];return next})}
 const matches=tools.filter(t=>(t.name+" "+t.summary).toLowerCase().includes(query.toLowerCase()));
 const canRun=!busy&&(tool.noInput||files.length>=(tool.multi&&tool.id!=="images_pdf"?2:1))&&(tool.id!=="digital_sign"||!!certificate)&&(tool.id!=="fill_forms"||fields.length>0);
 return <main className="app-shell">
  <header className="topbar"><div className="brand"><span className="brand-mark">P</span><span>pdfmerge</span><small>0.3</small></div><span className="local-badge"><span className="status-dot"/>Everything stays on your computer</span></header>
  <div className="layout">
   <aside className="tool-sidebar" aria-label="PDF tools"><h1>Your PDF workspace</h1><input className="tool-search" placeholder="Find a tool…" aria-label="Find a tool" value={query} onChange={e=>setQuery(e.target.value)}/>
    {Array.from(new Set(matches.map(t=>t.group))).map(group=><div className="tool-group" key={group}><h2>{group}</h2>{matches.filter(t=>t.group===group).map(t=><button key={t.id} disabled={busy} className={"tool-choice "+(tool.id===t.id?"selected":"")} aria-current={tool.id===t.id?"page":undefined} onClick={()=>selectTool(t)}>{t.name}</button>)}</div>)}
   </aside>
   <section className={"workspace "+(isEditor&&files.length?"wide":"")} aria-labelledby="tool-title">
    <div className="workspace-head"><span className="eyebrow">{tool.group}</span><h2 id="tool-title">{tool.name}</h2><p>{tool.summary}</p></div>
    <div className="workspace-body">
     {!tool.noInput&&<>
      <div className="section-title"><div><h3>{tool.multi?"Your files":"Your file"}</h3><p>{files.length?files.length+" selected":"Choose a file to begin"}</p></div><button className="secondary-button" disabled={busy} onClick={()=>void addFiles()}>{files.length&&!tool.multi?"Change file":"+ Choose files"}</button></div>
      {!files.length?<button className="empty-state" onClick={()=>void addFiles()} disabled={busy}><span className="document-icon">PDF</span><strong>Choose {tool.multi?"files":"a file"} from your computer</strong><span>{tool.extensions?.map(e=>e.toUpperCase()).join(" · ")||"PDF documents"}</span></button>:
       <ol className="file-list">{files.map((path,index)=><li className="file-row" key={path}><span className="file-position">{index+1}</span><span className="mini-document">PDF</span><span className="file-description"><strong title={path}>{fileName(path)}</strong></span>{tool.multi&&<div className="row-actions"><button disabled={busy||index===0} onClick={()=>move(index,-1)} aria-label="Move file up">↑</button><button disabled={busy||index===files.length-1} onClick={()=>move(index,1)} aria-label="Move file down">↓</button><button disabled={busy} onClick={()=>setFiles(v=>v.filter((_,i)=>i!==index))} aria-label="Remove file">×</button></div>}</li>)}</ol>}
     </>}
     {isEditor&&files.length>0?<PdfEditor key={tool.id+files[0]} path={files[0]} initialMode={tool.id==="sign"?"signature":tool.id==="redact"?"redact":"select"} onDirtyChange={setDirty} onBusyChange={setBusy}/>:<>
      {(files.length>0||tool.noInput)&&<div className="options">
       {tool.params?.map(p=><label key={p.key}>{p.label}{p.type==="select"?<select disabled={busy} value={params[p.key]??p.value??""} onChange={e=>setParams({...params,[p.key]:e.target.value})}>{p.options?.map(v=><option key={v}>{v}</option>)}</select>:p.type==="textarea"?<textarea disabled={busy} rows={4} value={params[p.key]??""} onChange={e=>setParams({...params,[p.key]:e.target.value})}/>:<input disabled={busy} type={p.type||"text"} value={params[p.key]??p.value??""} onChange={e=>setParams({...params,[p.key]:p.type==="number"?Number(e.target.value):e.target.value})} autoComplete="off"/>}{p.hint&&<small>{p.hint}</small>}</label>)}
       {tool.id==="digital_sign"&&<label>Signing certificate<button className="secondary-button" onClick={async()=>{const p=await open({filters:[{name:"Signing certificate",extensions:["pfx","p12"]}]});if(typeof p==="string")setCertificate(p)}}>{certificate?fileName(certificate):"Choose PFX or P12"}</button></label>}
       {tool.id==="fill_forms"&&(fields.length?fields.map(f=><label key={f.name}>{f.name}{f.type==="/Btn"?<select value={values[f.name]} onChange={e=>setValues({...values,[f.name]:e.target.value})}>{(f.options.length?f.options:["/Off","/Yes"]).map(v=><option key={v} value={v}>{v==="/Off"?"Unchecked":v.replace(/^\//,"")}</option>)}</select>:f.options.length?<select value={values[f.name]} onChange={e=>setValues({...values,[f.name]:e.target.value})}>{f.options.map(v=><option key={v}>{v}</option>)}</select>:<input value={values[f.name]||""} onChange={e=>setValues({...values,[f.name]:e.target.value})}/>}</label>):<p className="tool-note">No interactive fields were found. Add a text field using Edit PDF.</p>)}
      </div>}
      {tool.note&&<p className="tool-note">{tool.note}</p>}
     </>}
    </div>
    {!isEditor&&<div className="workspace-footer"><span>Save to a new file. Your original stays intact.</span><button className="primary-button" disabled={!canRun} onClick={()=>void run()}>{busy?"Processing…":"Save result →"}</button></div>}
    {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
   </section>
  </div>
 </main>
}
