import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

type PdfObject={id:number;kind:string;x:number;y:number;width:number;height:number;text?:string;size?:number};
type Preview={count:number;page:number;width:number;height:number;image:string;objects:PdfObject[]};
type Edit={kind:string;page:number;x:number;y:number;width:number;height:number;text?:string;size?:number;color?:string;data?:string;url?:string;objectId?:number;points?:number[][]};
const engine=<T,>(request:object)=>invoke<T>("run_engine",{request});
const modes=[["select","Select"],["text","Text"],["image","Image"],["signature","Signature"],["rectangle","Rectangle"],["ellipse","Circle"],["line","Line"],["ink","Draw"],["link","Link"],["field","Text field"],["checkbox","Checkbox"],["redact","Redact"]];

export default function PdfEditor({path,initialMode="select",onDirtyChange,onBusyChange}:{path:string;initialMode?:string;onDirtyChange:(dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void}) {
 const [preview,setPreview]=useState<Preview>();
 const [page,setPage]=useState(0);
 const [mode,setMode]=useState(initialMode);
 const [edits,setEdits]=useState<Edit[]>([]);
 const [draft,setDraft]=useState<Edit>();
 const [selected,setSelected]=useState<PdfObject>();
 const [selectedEdit,setSelectedEdit]=useState<number>();
 const [text,setText]=useState("Your text");
 const [size,setSize]=useState(16);
 const [color,setColor]=useState("#1d3927");
 const [asset,setAsset]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [showSignature,setShowSignature]=useState(initialMode==="signature");
 const [signatureError,setSignatureError]=useState("");
 const signature=useRef<HTMLCanvasElement>(null);
 const drawing=useRef(false);
 const start=useRef<{x:number;y:number;index?:number;original?:Edit}|undefined>(undefined);
 const svg=useRef<SVGSVGElement>(null);
 useEffect(()=>{onDirtyChange(edits.length>0)},[edits,onDirtyChange]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false)},[busy,onBusyChange]);

 useEffect(()=>{let active=true;setBusy(true);setError("");
  engine<Preview>({tool:"preview",inputs:[path],page}).then(p=>{if(active)setPreview(p)}).catch(e=>{if(active)setError(String(e))}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[path,page]);
 function point(e:React.PointerEvent<SVGSVGElement>){const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*(preview?.width||1),y:(e.clientY-r.top)/r.height*(preview?.height||1)}}
 function down(e:React.PointerEvent<SVGSVGElement>){
  if(busy||!preview)return;
  const p=point(e);e.currentTarget.setPointerCapture(e.pointerId);
  if(mode==="select"){setSelectedEdit(undefined);return;}
  if((mode==="image"||mode==="signature")&&!asset){setError("Choose an image or draw a signature first.");return;}
  start.current=p;
  setSelected(undefined);
  const op:Edit={kind:mode,page,...p,width:160,height:mode==="text"?size*1.4:60,text,size,color,data:asset,url:mode==="link"?text:undefined};
  if(mode==="checkbox"){op.width=op.height=20}
  if(mode==="ink")op.points=[[p.x,p.y]];
  setDraft(op);
 }
 function move(e:React.PointerEvent<SVGSVGElement>){
  if(!start.current)return;
  const p=point(e);
  if(start.current.index!==undefined&&start.current.original){
   const {index,original,x,y}=start.current;
   setEdits(items=>items.map((op,i)=>i===index?{...op,x:Math.max(0,original.x+p.x-x),y:Math.max(0,original.y+p.y-y),points:original.points?.map(([px,py])=>[px+p.x-x,py+p.y-y])}:op));
  } else if(draft){
   if(mode==="ink")setDraft({...draft,points:[...(draft.points||[]),[p.x,p.y]]});
   else if(!["text","image","signature","checkbox"].includes(mode))setDraft({...draft,x:Math.min(start.current.x,p.x),y:Math.min(start.current.y,p.y),width:Math.max(10,Math.abs(p.x-start.current.x)),height:Math.max(10,Math.abs(p.y-start.current.y))});
  }
 }
 function up(){if(draft){setEdits(v=>[...v,draft]);setDraft(undefined)}start.current=undefined}
 async function image(){
  try{const file=await open({filters:[{name:"Images",extensions:["png","jpg","jpeg","webp"]}]});if(typeof file!=="string")return;
   const result=await engine<{data:string}>({tool:"read_image",inputs:[file]});setAsset(result.data);setMode("image");
  }catch(e){setError(String(e))}
 }
 function replace(){
  if(!selected)return;
  setEdits(v=>[...v,{kind:selected.kind==="text"?"text":"image",page,x:selected.x,y:selected.y,width:selected.width,height:selected.height,text,size,color,data:asset,objectId:selected.id}]);
  setSelected(undefined);
 }
 async function saveEdits(){
  setError("");setMessage("");
  const output=await save({defaultPath:path.replace(/\.pdf$/i,"-edited.pdf"),filters:[{name:"PDF",extensions:["pdf"]}]});
  if(!output)return;
  setBusy(true);
  try{const result=await engine<{message:string}>({tool:"edit",inputs:[path],output,operations:edits});setMessage(result.message+" "+output);onDirtyChange(false)}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 function useSignature(){
  const source=signature.current!;const ctx=source.getContext("2d")!;const data=ctx.getImageData(0,0,source.width,source.height).data;
  let left=source.width,top=source.height,right=0,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(data[(y*source.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  if(right<=left||bottom<=top){setSignatureError("Draw a signature first.");return}
  const cropped=document.createElement("canvas");cropped.width=right-left+10;cropped.height=bottom-top+10;
  cropped.getContext("2d")!.drawImage(source,left,top,right-left+1,bottom-top+1,5,5,right-left+1,bottom-top+1);
  setAsset(cropped.toDataURL("image/png"));setMode("signature");setShowSignature(false);setSignatureError("");
 }
 function renderOp(op:Edit,key:number){
  const props={key,stroke:op.color||color,strokeWidth:1.5,onPointerDown:(e:React.PointerEvent<SVGGElement>)=>{
   if(mode!=="select")return;e.stopPropagation();setSelectedEdit(key);setSelected(undefined);const r=svg.current!.getBoundingClientRect();
   start.current={x:(e.clientX-r.left)/r.width*preview!.width,y:(e.clientY-r.top)/r.height*preview!.height,index:key,original:op};svg.current?.setPointerCapture(e.pointerId);
  },style:{cursor:mode==="select"?"move":"crosshair"}};
  const x=op.x,y=op.y,w=op.width,h=op.height;
  return <g {...props}>
   {op.objectId!==undefined&&<rect x={x} y={y-2} width={w+3} height={h+5} fill="white" stroke="none"/>}
   {op.kind==="text"?<text x={x} y={y+(op.size||16)} fontSize={op.size} fill={op.color} stroke="none">{(op.text||"").split("\n").map((line,i)=><tspan key={i} x={x} dy={i?1.2*(op.size||16):0}>{line}</tspan>)}</text>
    :["image","signature"].includes(op.kind)?<image href={op.data} x={x} y={y} width={w} height={h} preserveAspectRatio="none"/>
    :op.kind==="ellipse"?<ellipse cx={x+w/2} cy={y+h/2} rx={w/2} ry={h/2} fill="none"/>
    :op.kind==="line"?<line x1={x} y1={y} x2={x+w} y2={y+h}/>
    :op.kind==="ink"?<polyline points={op.points?.map(p=>p.join(",")).join(" ")} fill="none"/>
    :op.kind==="delete"?null:<rect x={x} y={y} width={w} height={h} fill={op.kind==="redact"?"black":op.kind==="field"||op.kind==="checkbox"?"#ddecff88":"none"} strokeDasharray={op.kind==="link"?"4 3":undefined}/>}
  </g>
 }
 return <div className="editor">
  <div className="editor-toolbar">{modes.map(([id,label])=><button key={id} className={mode===id?"active":""} disabled={busy} onClick={()=>{setMode(id);setSelected(undefined);if(id==="signature")setShowSignature(true);if(id==="image")void image()}}>{label}</button>)}</div>
  <div className="editor-options">
   <label>{mode==="link"?"URL":"Text / field name"}<input value={text} onChange={e=>setText(e.target.value)}/></label>
   <label>Size<input type="number" min="5" max="144" value={size} onChange={e=>setSize(Number(e.target.value))}/></label>
   <label>Color<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
   <button className="secondary-button" disabled={!edits.length||busy} onClick={()=>setEdits(v=>v.slice(0,-1))}>Undo</button>
  </div>
  {selected&&<div className="selection-panel"><span>Selected {selected.kind}</span><button onClick={replace} disabled={selected.kind==="image"&&!asset}>Replace with {selected.kind==="text"?"text above":"chosen image"}</button>{selected.kind==="image"&&<button onClick={()=>void image()}>Choose image</button>}<button onClick={()=>{setEdits(v=>[...v,{...selected,kind:"delete",page,objectId:selected.id}]);setSelected(undefined)}}>Delete original</button></div>}
  {selectedEdit!==undefined&&edits[selectedEdit]&&<div className="edit-inspector"><strong>{edits[selectedEdit].kind}</strong>{(["x","y","width","height"] as const).map(key=><label key={key}>{key}<input type="number" value={Math.round(edits[selectedEdit][key])} onChange={e=>setEdits(items=>items.map((op,i)=>i===selectedEdit?{...op,[key]:Math.max(key==="width"||key==="height"?1:0,Number(e.target.value))}:op))}/></label>)}{edits[selectedEdit].kind==="text"&&<button onClick={()=>setEdits(items=>items.map((op,i)=>i===selectedEdit?{...op,text,size,color}:op))}>Apply text / style</button>}<button onClick={()=>{setEdits(items=>items.filter((_,i)=>i!==selectedEdit));setSelectedEdit(undefined)}}>Remove edit</button></div>}
  <div className="page-navigation"><button disabled={page===0||busy} onClick={()=>{setPage(page-1);setSelected(undefined)}}>←</button><span>Page {page+1} of {preview?.count||"…"}</span><button disabled={!preview||page>=preview.count-1||busy} onClick={()=>{setPage(page+1);setSelected(undefined)}}>→</button><span>{edits.length} edits</span></div>
  <p className="editor-hint">{mode==="select"?"Click original text or an image to edit it. Drag added content to move it.":mode==="signature"?"Draw a signature, then click the page to place it.":["text","image","checkbox"].includes(mode)?"Click the page to place content.":"Drag on the page to draw an area."}</p>
  <div className="page-stage">
   {preview&&<svg ref={svg} viewBox={`0 0 ${preview.width} ${preview.height}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{setDraft(undefined);start.current=undefined}} style={{touchAction:"none"}}>
    <image href={preview.image} width={preview.width} height={preview.height}/>
    {mode==="select"&&preview.objects.filter(obj=>!edits.some(op=>op.page===page&&op.objectId===obj.id)).map(obj=><rect key={obj.id} className={selected?.id===obj.id?"object-hit selected":"object-hit"} x={obj.x} y={obj.y} width={Math.max(obj.width,5)} height={Math.max(obj.height,5)} onPointerDown={e=>{e.stopPropagation();setSelected(obj);setText(obj.text||"");setSize(obj.size||16)}}/>)}
    {edits.map((op,i)=>op.page===page?renderOp(op,i):null)}
    {draft&&renderOp(draft,-1)}
   </svg>}
   {busy&&<div className="editor-loading">Processing…</div>}
  </div>
  <p className="tool-note">Replacing text uses a standard font. A drawn signature is a visual mark; use Certificate signing for cryptographic signing. Editing a signed PDF can invalidate its existing signatures.</p>
  {edits.some(op=>op.kind==="redact")&&<p className="notice error">Saving redactions permanently removes underlying content by converting all pages to images. Searchable text and interactive fields will be removed.</p>}
  <div className="editor-save"><button className="primary-button" disabled={busy||!edits.length} onClick={()=>void saveEdits()}>Save edited copy →</button></div>
  {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
  {showSignature&&<div className="modal-backdrop"><div className="signature-dialog" role="dialog" aria-modal="true" aria-label="Draw signature">
   <h2>Draw your signature</h2><p>Use your mouse, trackpad, or pen.</p>
   <canvas ref={signature} width={600} height={220} onPointerDown={e=>{drawing.current=true;e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();const c=e.currentTarget.getContext("2d")!;c.beginPath();c.moveTo((e.clientX-r.left)*600/r.width,(e.clientY-r.top)*220/r.height)}}
    onPointerMove={e=>{if(!drawing.current)return;const r=e.currentTarget.getBoundingClientRect();const c=e.currentTarget.getContext("2d")!;c.lineWidth=3;c.lineCap="round";c.strokeStyle="#13291d";c.lineTo((e.clientX-r.left)*600/r.width,(e.clientY-r.top)*220/r.height);c.stroke()}}
    onPointerUp={()=>{drawing.current=false}} onPointerCancel={()=>{drawing.current=false}}/>
   {signatureError&&<p role="alert">{signatureError}</p>}<div className="dialog-actions"><button onClick={()=>signature.current?.getContext("2d")?.clearRect(0,0,600,220)}>Clear</button><button onClick={()=>setShowSignature(false)}>Cancel</button><button className="primary-button" onClick={useSignature}>Use signature</button></div>
  </div></div>}
 </div>
}
