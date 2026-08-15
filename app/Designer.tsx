"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Design, Heading, historyFor, pointsFor, preparePricingTakeoff, removeBoundarySegment, splitForStock, summary, type Turn } from "../lib/geometry";
import { quoteVivaFrame, registerVivaFrameConfig, type PricingQuote, type VivaFrameConfig } from "../lib/pricing-client";

type Tab = "summary" | "cuts" | "bom";
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const blankDesign = ():Design => ({start:{x:0,y:0},initialHeading:null,segments:[]});
const headingOrder:Heading[] = ["N","E","S","W"];
function relativeTurn(from:Heading,to:Heading):Turn { const delta=(headingOrder.indexOf(to)-headingOrder.indexOf(from)+4)%4; return delta===0?"straight":delta===1?"right":delta===2?"back":"left"; }

export default function Designer() {
  const [design, setDesign] = useState<Design>(() => blankDesign());
  const [startPlaced, setStartPlaced] = useState(false);
  const [direction, setDirection] = useState<Heading | null>(null);
  const [nextLength, setNextLength] = useState(1000);
  const [editingDimension, setEditingDimension] = useState<string | null>(null);
  const [dimensionDraft, setDimensionDraft] = useState("");
  const [selected, setSelected] = useState("");
  const [selectedEnd, setSelectedEnd] = useState<"start" | "end" | null>(null);
  const [selectionNotice, setSelectionNotice] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [finish, setFinish] = useState("natural-anodised");
  const [profile, setProfile] = useState("vf40");
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [pricing, setPricing] = useState<"idle" | "loading" | "error">("idle");
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [liveConfig, setLiveConfig] = useState<VivaFrameConfig | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stats = useMemo(() => summary(design), [design]);
  const points = useMemo(() => pointsFor(design), [design]);
  const takeoff = useMemo(() => preparePricingTakeoff(design, profile, finish), [design, profile, finish]);
  useEffect(()=>{ registerVivaFrameConfig(setLiveConfig).catch(()=>setLiveConfig(null)); },[]);
  async function recalculate(){setPricing("loading");try{setQuote(await quoteVivaFrame(takeoff));setPricing("idle")}catch{setQuote(null);setPricing("error")}}
  const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
  const sx = Math.min(420 / Math.max(stats.width, 1), 275 / Math.max(stats.height, 1)) * zoom;
  const xy = (p:{x:number;y:number}) => stats.width===0&&stats.height===0?{x:310,y:210}:({x:100+(p.x-minX)*sx,y:68+(p.y-minY)*sx});

  function changeLength(id:string, length:number) { setDesign(d => ({...d,segments:d.segments.map(s=>s.id===id?{...s,length:Math.max(1,Math.round(length))}:s)})); }
  function selectSegment(id:string){setSelected(id);setSelectedEnd(null);setSelectionNotice("")}
  function selectEnd(boundary:"start"|"end"){setSelected("");setSelectedEnd(boundary);setSelectionNotice("")}
  function addSegment() { if(!startPlaced||!direction||nextLength<=0)return; const last=design.segments.at(-1), id=`s${Date.now()}`; setDesign(d=>({...d,initialHeading:d.initialHeading??direction,segments:[...d.segments,{id,heading:direction,length:Math.round(nextLength),turn:last?relativeTurn(last.heading,direction):"straight"}]})); selectSegment(id); setDirection(null); }
  function beginDimensionEdit(id:string,length:number){selectSegment(id);setEditingDimension(id);setDimensionDraft(String(length));}
  function commitDimensionEdit(){if(editingDimension){const value=Number(dimensionDraft);if(Number.isFinite(value)&&value>0)changeLength(editingDimension,value)}setEditingDimension(null)}
  function undo(){ if(design.segments.length) setDesign(d=>({...d,segments:d.segments.slice(0,-1)})); }
  function deleteSelection(){
    if(!design.segments.length)return;
    let boundary=selectedEnd;
    if(!boundary&&selected){const index=design.segments.findIndex(segment=>segment.id===selected);if(index===0)boundary="start";else if(index===design.segments.length-1)boundary="end";else if(index>=0){setSelectionNotice("Only the first or last segment in the sequence can be deleted.");return}}
    if(!boundary)return;
    setDesign(d=>removeBoundarySegment(d,boundary!));setSelected("");setSelectedEnd(null);setSelectionNotice("");setEditingDimension(null);setDirection(null);
  }
  useEffect(()=>{ const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(["INPUT","SELECT","TEXTAREA"].includes(target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}else if(e.key==="Delete"){e.preventDefault();deleteSelection()}else if(e.key==="ArrowLeft")setDirection("W");else if(e.key==="ArrowUp")setDirection("N");else if(e.key==="ArrowRight")setDirection("E");else if(e.key==="ArrowDown")setDirection("S");else if(e.key==="Enter")addSegment();}; window.addEventListener("keydown",key); return()=>window.removeEventListener("keydown",key); });
  function exportDesign(){ const a=document.createElement("a"),blob=new Blob([JSON.stringify({schemaVersion:1,name:"Reception display frame",design,productIds:{profile,finish}},null,2)],{type:"application/json"});a.href=URL.createObjectURL(blob);a.download="vivaframe-design.json";a.click();URL.revokeObjectURL(a.href); }
  async function importDesign(file?:File){if(!file)return;const data=JSON.parse(await file.text());setDesign(data.design);setStartPlaced(true);setProfile(data.productIds?.profile||"vf40");setFinish(data.productIds?.finish||"natural-anodised");}

  return <div className="shell">
    <nav className="appnav" aria-label="Application pages"><a href="https://vivalux4-client.netlify.app/">Backlit</a><a href="https://vivalux4-client.netlify.app/edgelit">Edgelit</a><a href="https://vivalux4-client.netlify.app/r300/">R300</a><a href="https://vivalux4-client.netlify.app/palisade">Palisade</a><a href="https://vivalux4-client.netlify.app/cube">Cube</a><a href="https://vivalux4-client.netlify.app/lanterns/">Lanterns</a><a className="active" href="/vivaframe">VivaFrame Designer</a><a className="cart" href="https://vivad.com.au/shopping-cart">Go to Cart</a></nav>
    <header className="productbar"><div className="brand"><span>V</span><div><b>VIVAD</b><small>VivaFrame Designer</small></div><i>Live</i></div><div className="actions"><button onClick={()=>{setDesign(blankDesign());setStartPlaced(false);setSelected("");setSelectedEnd(null);setSelectionNotice("");setDirection(null)}}>＋ New</button><button onClick={()=>setSaved(true)}>▣ Save</button><button onClick={exportDesign}>⇩ Export</button><button onClick={()=>fileRef.current?.click()}>⇧ Import</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={e=>importDesign(e.target.files?.[0])}/></div></header>
    {saved&&<div className="toast" role="status"><b>✓</b><span><strong>Design saved</strong><small>Reception display frame</small></span><button onClick={()=>setSaved(false)} aria-label="Dismiss">×</button></div>}
    <main className="layout">
      <aside className="config">
        <div className="panel-title"><span>VF</span><div><h1>VivaFrame Designer</h1><small>Frame configuration</small></div></div>
        <Section title="DESIGN"><label>Short Name<input defaultValue="Reception display frame"/></label><label>QTY<input type="number" min="1" defaultValue="1"/></label></Section>
        <Section title="MATERIAL"><label>Extrusion Profile<select value={profile} onChange={e=>setProfile(e.target.value)}><option value="vf40">VF40 — 40 mm profile</option><option value="vf25">VF25 — 25 mm profile</option></select></label><label>Finish<select value={finish} onChange={e=>setFinish(e.target.value)}><option value="natural-anodised">Natural anodised</option><option value="black-anodised">Black anodised</option><option value="white-powdercoat">White powder coat</option></select></label></Section>
        <Section title="NEXT SEGMENT"><p className="instruction">{!startPlaced?"Place a starting point on the canvas.":stats.closed?"Frame closed. Select a dimension to edit it.":"Choose an absolute direction, then enter a length."}</p><div className="directions">{([["N","↑","Up"],["W","←","Left"],["E","→","Right"],["S","↓","Down"]] as [Heading,string,string][]).map(([value,arrow,label])=><button key={value} className={direction===value?"chosen":""} onClick={()=>setDirection(value)} disabled={!startPlaced||stats.closed}><b>{arrow}</b>{label}</button>)}</div><label className="next-length">Length<input type="number" min="1" step={snap?50:1} value={nextLength} onChange={e=>setNextLength(Number(e.target.value))} onKeyDown={e=>{if(e.key==="Enter")addSegment()}}/><span>mm</span></label><button className="add-segment" onClick={addSegment} disabled={!startPlaced||!direction||nextLength<=0||stats.closed}>Add segment</button><button className="undo" onClick={undo}>↶ Undo last segment <kbd>⌘Z</kbd></button></Section>
      </aside>
      <section className="stage">
        <div className="stage-head"><div><h2>Build Preview</h2><span className={stats.closed?"success":"open-status"}>{stats.closed?"✓ Closed frame":startPlaced?"Open frame":"Place start point"}</span></div><div className="tools"><button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}>＋</button><button onClick={()=>setZoom(z=>Math.max(.6,z-.1))}>−</button><button onClick={()=>setZoom(1)}>Fit frame</button><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/><i/>Snap 50 mm</label></div></div>
        <div className={`canvas ${snap?"grid":""}`}>
          {!startPlaced?<button className="place" onClick={()=>setStartPlaced(true)}>＋ Click to place the starting point</button>:<svg viewBox="0 0 620 420" role="img" aria-label={design.segments.length?`Frame ${stats.width} by ${stats.height} millimetres`:"Starting point placed; choose a direction"}>
            {design.segments.map((s,i)=>{const a=xy(points[i]),b=xy(points[i+1]),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;return <g key={s.id} className={selected===s.id?"selected":""} onClick={()=>selectSegment(s.id)}><line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="rail" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="face" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>{editingDimension===s.id?<foreignObject x={mx-48} y={my-18} width="96" height="36" onClick={e=>e.stopPropagation()}><input className="dimension-edit" autoFocus inputMode="numeric" value={dimensionDraft} onChange={e=>setDimensionDraft(e.target.value)} onBlur={commitDimensionEdit} onKeyDown={e=>{if(e.key==="Enter")commitDimensionEdit();if(e.key==="Escape")setEditingDimension(null)}} aria-label={`Edit segment ${i+1} length in millimetres`}/></foreignObject>:<g className="dimension-label" transform={`translate(${mx} ${my})`} onClick={e=>{e.stopPropagation();beginDimensionEdit(s.id,s.length)}} role="button" tabIndex={0} aria-label={`Edit ${s.length} millimetre dimension`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();beginDimensionEdit(s.id,s.length)}}}><rect x="-38" y="-13" width="76" height="26" rx="4"/><text dy="4" textAnchor="middle">{s.length} mm</text></g>}</g>})}
            {points.map((p,i)=>{const q=xy(p),isStart=i===0,isEnd=i===points.length-1&&points.length>1;if(isStart||isEnd){const endType:"start"|"end"=isEnd?"end":"start";return <g key={i} className={`selectable-point ${selectedEnd===endType?"point-selected":""}`} onClick={e=>{e.stopPropagation();selectEnd(endType)}} role="button" tabIndex={0} aria-label={`Select ${endType} point`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectEnd(endType)}}}><circle className="point-hit" cx={q.x} cy={q.y} r="16"/><circle cx={q.x} cy={q.y} r="8" className={endType==="start"?"start":"current"}/></g>}return <circle key={i} cx={q.x} cy={q.y} r="4" className="joint"/>})}
          </svg>}
          <div className="legend"><span><i className="start-dot"/>Start</span><span><i className="current-dot"/>Current</span></div>
        </div>
        <div className="stage-foot"><span className={selectionNotice?"selection-error":""}>{selectionNotice||(selectedEnd?`${selectedEnd==="start"?"Start":"End"} point selected · Delete removes the adjacent boundary segment.`:selected?"Segment selected · Delete is available only at the beginning or end of the sequence.":"Orthogonal drawing · dimensions in millimetres")}</span><b>{Math.round(zoom*100)}%</b></div>
        <section className="history"><button onClick={()=>setHistoryOpen(v=>!v)}><span><b>Construction history</b><small>Generated from the frame</small></span>{historyOpen?"⌄":"⌃"}</button>{historyOpen&&<div>{historyFor(design).map((line,i)=><code key={i}><em>{String(i+1).padStart(2,"0")}</em>{line}</code>)}</div>}</section>
      </section>
      <aside className="results">
        <div className="tabs" role="tablist">{(["summary","cuts","bom"] as Tab[]).map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t==="cuts"?"Cut list":t.toUpperCase()}</button>)}</div>
        {tab==="summary"&&<Summary stats={stats} count={design.segments.length} pricing={pricing} quote={quote} configured={!!liveConfig} onRecalculate={recalculate}/>} 
        {tab==="cuts"&&<CutList design={design} selected={selected} changeLength={changeLength}/>} 
        {tab==="bom"&&<Bom takeoff={takeoff}/>} 
      </aside>
    </main>
  </div>;
}

function Section({title,children}:{title:string;children:React.ReactNode}){return <section><h2>{title}</h2>{children}</section>}
function Summary({stats,count,pricing,quote,configured,onRecalculate}:{stats:ReturnType<typeof summary>;count:number;pricing:string;quote:PricingQuote|null;configured:boolean;onRecalculate:()=>void}){return <><div className={stats.closed?"complete":"frame-progress"}><span>{stats.closed?"✓":"＋"}</span><div><b>{stats.closed?"Frame is complete":count?"Frame is open":"Ready to draw"}</b><small>{stats.closed?"All segments form a closed path.":count?"Add segments until the current point returns to the start.":"Place a start point, choose a direction and enter a length."}</small></div></div><Section title="FRAME SUMMARY"><dl>{[["Overall width",`${stats.width.toLocaleString()} mm`],["Overall height",`${stats.height.toLocaleString()} mm`],["Total perimeter",`${stats.perimeter.toLocaleString()} mm`],["Extrusion pieces",count],["90° corners",stats.corners],["45° mitre cuts",stats.mitres]].map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl></Section><Section title="STOCK ESTIMATE"><div className="stock"><b>{stats.stock}</b><span><strong>× 5,600 mm lengths</strong><small>Simple estimate</small></span></div><div className="waste"><span>Estimated material waste</span><b>{stats.waste.toLocaleString()} mm</b><i><em style={{width:stats.stock?`${Math.max(3,stats.waste/(stats.stock*5600)*100)}%`:"0%"}}/></i></div></Section><Section title="PRICING">{quote&&typeof quote.total==="number"?<div className="quoted"><small>Total ex GST</small><strong>{money.format(quote.total)}</strong></div>:<div className="price-warning"><b>i</b><span><strong>{configured?"Pricing temporarily unavailable":"Pricing managed by Vivalux Builder"}</strong><small>{configured?"The Pricing Engine did not return a current price. No fallback price is shown.":"Open this designer through Vivalux Builder to apply customer, account, tax and currency context."}</small></span></div>}<button className="primary" onClick={onRecalculate} disabled={pricing==="loading"||!configured||!stats.closed}>{pricing==="loading"?"Recalculating…":configured?"↻ Recalculate price":"Available in Vivalux Builder"}</button><p className="last">Last calculated: {quote?.calculatedAt?new Date(quote.calculatedAt).toLocaleString("en-AU"):"Never"}</p></Section></>}
function CutList({design,selected,changeLength}:{design:Design;selected:string;changeLength:(id:string,n:number)=>void}){let n=0;return <div className="data"><h3>Manufacturable pieces</h3><p>Finished outside / long-point measurements.</p>{design.segments.flatMap(s=>splitForStock(s.length).map((length,j,a)=>({s,length,j,a}))).map(({s,length,j,a})=><article key={`${s.id}-${j}`} className={selected===s.id?"row-selected":""} onClick={()=>{}}><span>{++n}</span><div><b>VF40 extrusion</b><small>{j===0?"45°":"90°"} / {j===a.length-1?"45°":"90°"} end cuts</small></div><label><input type="number" value={length} onChange={e=>changeLength(s.id,Number(e.target.value))}/><i>mm</i></label></article>)}</div>}
function Bom({takeoff}:{takeoff:ReturnType<typeof preparePricingTakeoff>}){return <div className="data"><h3>Pricing line items</h3><p>Prepared separately from canvas geometry.</p><article><span>{takeoff.cutPieces.length}</span><div><b>VivaFrame extrusion</b><small>{takeoff.profileId} · {takeoff.finishId}</small></div><em className="unmapped">Mapping required</em></article>{takeoff.accessories.map(a=><article key={a.mappingKey}><span>{a.quantity}</span><div><b>{a.mappingKey.replaceAll("_"," ")}</b><small>Canonical Pricing Engine ID required</small></div><em className="unmapped">Unmapped</em></article>)}<div className="blocked">Complete price blocked until required APP mappings are configured.</div></div>}
