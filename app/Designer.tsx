"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Design, historyFor, pointsFor, preparePricingTakeoff, rectangle, splitForStock, summary, turnHeading } from "../lib/geometry";
import { quoteVivaFrame, registerVivaFrameConfig, type PricingQuote, type VivaFrameConfig } from "../lib/pricing-client";

type Tab = "summary" | "cuts" | "bom";
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export default function Designer() {
  const [design, setDesign] = useState<Design>(() => rectangle());
  const [selected, setSelected] = useState("s1");
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
  const xy = (p:{x:number;y:number}) => ({x:100+(p.x-minX)*sx,y:68+(p.y-minY)*sx});

  function changeLength(id:string, length:number) { setDesign(d => ({...d,segments:d.segments.map(s=>s.id===id?{...s,length:Math.max(1,Math.round(length))}:s)})); }
  function turn(turn:"left"|"straight"|"right") {
    const last = design.segments.at(-1); if (!last) return;
    setDesign(d=>({...d,segments:[...d.segments,{id:`s${Date.now()}`,heading:turnHeading(last.heading,turn),length:500,turn}]}));
  }
  function undo(){ if(design.segments.length) setDesign(d=>({...d,segments:d.segments.slice(0,-1)})); }
  useEffect(()=>{ const key=(e:KeyboardEvent)=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()} else if(e.key==="ArrowLeft")turn("left"); else if(e.key==="ArrowUp")turn("straight"); else if(e.key==="ArrowRight")turn("right"); }; window.addEventListener("keydown",key); return()=>window.removeEventListener("keydown",key); });
  function exportDesign(){ const a=document.createElement("a"),blob=new Blob([JSON.stringify({schemaVersion:1,name:"Reception display frame",design,productIds:{profile,finish}},null,2)],{type:"application/json"});a.href=URL.createObjectURL(blob);a.download="vivaframe-design.json";a.click();URL.revokeObjectURL(a.href); }
  async function importDesign(file?:File){if(!file)return;const data=JSON.parse(await file.text());setDesign(data.design);setProfile(data.productIds?.profile||"vf40");setFinish(data.productIds?.finish||"natural-anodised");}

  return <div className="shell">
    <nav className="appnav" aria-label="Application pages"><a href="https://vivalux4-client.netlify.app/">Backlit</a><a href="https://vivalux4-client.netlify.app/edgelit">Edgelit</a><a href="https://vivalux4-client.netlify.app/r300/">R300</a><a href="https://vivalux4-client.netlify.app/palisade">Palisade</a><a href="https://vivalux4-client.netlify.app/cube">Cube</a><a href="https://vivalux4-client.netlify.app/lanterns/">Lanterns</a><a className="active" href="/vivaframe">VivaFrame Designer</a><a className="cart" href="https://vivad.com.au/shopping-cart">Go to Cart</a></nav>
    <header className="productbar"><div className="brand"><span>V</span><div><b>VIVAD</b><small>VivaFrame Designer</small></div><i>Live</i></div><div className="actions"><button onClick={()=>setDesign(rectangle())}>＋ New</button><button onClick={()=>setSaved(true)}>▣ Save</button><button onClick={exportDesign}>⇩ Export</button><button onClick={()=>fileRef.current?.click()}>⇧ Import</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={e=>importDesign(e.target.files?.[0])}/></div></header>
    {saved&&<div className="toast" role="status"><b>✓</b><span><strong>Design saved</strong><small>Reception display frame</small></span><button onClick={()=>setSaved(false)} aria-label="Dismiss">×</button></div>}
    <main className="layout">
      <aside className="config">
        <div className="panel-title"><span>VF</span><div><h1>VivaFrame Designer</h1><small>Frame configuration</small></div></div>
        <Section title="DESIGN"><label>Short Name<input defaultValue="Reception display frame"/></label><label>QTY<input type="number" min="1" defaultValue="1"/></label></Section>
        <Section title="START WITH"><div className="templates"><button className="chosen" onClick={()=>setDesign(rectangle())}><i className="rect"/>Rectangle</button><button onClick={()=>setDesign({...rectangle(),segments:rectangle().segments.slice(0,3)})}><i className="lshape"/>L-shape</button><button><i className="ushape"/>U-shape</button><button onClick={()=>setDesign({start:{x:0,y:0},initialHeading:"E",segments:[]})}><b>＋</b>Blank</button></div></Section>
        <Section title="MATERIAL"><label>Extrusion Profile<select value={profile} onChange={e=>setProfile(e.target.value)}><option value="vf40">VF40 — 40 mm profile</option><option value="vf25">VF25 — 25 mm profile</option></select></label><label>Finish<select value={finish} onChange={e=>setFinish(e.target.value)}><option value="natural-anodised">Natural anodised</option><option value="black-anodised">Black anodised</option><option value="white-powdercoat">White powder coat</option></select></label></Section>
        <Section title="NEXT SEGMENT"><p className="instruction">{stats.closed?"Frame closed. Select a segment to edit.":"Choose left, straight or right."}</p><div className="turns"><button onClick={()=>turn("left")}><b>↰</b>Left<kbd>←</kbd></button><button onClick={()=>turn("straight")}><b>↑</b>Straight<kbd>↑</kbd></button><button onClick={()=>turn("right")}><b>↱</b>Right<kbd>→</kbd></button></div><button className="undo" onClick={undo}>↶ Undo last segment <kbd>⌘Z</kbd></button></Section>
      </aside>
      <section className="stage">
        <div className="stage-head"><div><h2>Build Preview</h2><span className="success">✓ Closed frame</span></div><div className="tools"><button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}>＋</button><button onClick={()=>setZoom(z=>Math.max(.6,z-.1))}>−</button><button onClick={()=>setZoom(1)}>Fit frame</button><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/><i/>Snap 50 mm</label></div></div>
        <div className={`canvas ${snap?"grid":""}`}>
          {design.segments.length===0?<button className="place" onClick={()=>setDesign({start:{x:0,y:0},initialHeading:"E",segments:[{id:"s1",heading:"E",length:1000,turn:"straight"}]})}>＋ Click to place the starting point</button>:<svg viewBox="0 0 620 420" role="img" aria-label={`Frame ${stats.width} by ${stats.height} millimetres`}>
            {design.segments.map((s,i)=>{const a=xy(points[i]),b=xy(points[i+1]),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;return <g key={s.id} className={selected===s.id?"selected":""} onClick={()=>setSelected(s.id)}><line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="rail" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="face" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><g transform={`translate(${mx} ${my})`}><rect x="-38" y="-13" width="76" height="26" rx="4"/><text dy="4" textAnchor="middle">{s.length} mm</text></g></g>})}
            {points.map((p,i)=>{const q=xy(p);return <circle key={i} cx={q.x} cy={q.y} r={i===0?8:4} className={i===0?"start":"joint"}/>})}
          </svg>}
          <div className="legend"><span><i className="start-dot"/>Start</span><span><i className="current-dot"/>Current</span></div>
        </div>
        <div className="stage-foot"><span>Orthogonal drawing · dimensions in millimetres</span><b>{Math.round(zoom*100)}%</b></div>
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
function Summary({stats,count,pricing,quote,configured,onRecalculate}:{stats:ReturnType<typeof summary>;count:number;pricing:string;quote:PricingQuote|null;configured:boolean;onRecalculate:()=>void}){return <><div className="complete"><span>✓</span><div><b>Frame is complete</b><small>All segments form a closed path.</small></div></div><Section title="FRAME SUMMARY"><dl>{[["Overall width",`${stats.width.toLocaleString()} mm`],["Overall height",`${stats.height.toLocaleString()} mm`],["Total perimeter",`${stats.perimeter.toLocaleString()} mm`],["Extrusion pieces",count],["90° corners",stats.corners],["45° mitre cuts",stats.mitres]].map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl></Section><Section title="STOCK ESTIMATE"><div className="stock"><b>{stats.stock}</b><span><strong>× 5,600 mm lengths</strong><small>Simple estimate</small></span></div><div className="waste"><span>Estimated material waste</span><b>{stats.waste.toLocaleString()} mm</b><i><em style={{width:`${Math.max(3,stats.waste/(stats.stock*5600)*100)}%`}}/></i></div></Section><Section title="PRICING">{quote&&typeof quote.total==="number"?<div className="quoted"><small>Total ex GST</small><strong>{money.format(quote.total)}</strong></div>:<div className="price-warning"><b>!</b><span><strong>{configured?"Pricing unavailable":"Sign in to load pricing"}</strong><small>The live Vivalux Pricing workflow uses customer and account context. No fallback price is shown.</small></span></div>}<button className="primary" onClick={onRecalculate} disabled={pricing==="loading"}>{pricing==="loading"?"Recalculating…":"↻ Recalculate price"}</button><p className="last">Last calculated: {quote?.calculatedAt?new Date(quote.calculatedAt).toLocaleString("en-AU"):"Never"}</p></Section></>}
function CutList({design,selected,changeLength}:{design:Design;selected:string;changeLength:(id:string,n:number)=>void}){let n=0;return <div className="data"><h3>Manufacturable pieces</h3><p>Finished outside / long-point measurements.</p>{design.segments.flatMap(s=>splitForStock(s.length).map((length,j,a)=>({s,length,j,a}))).map(({s,length,j,a})=><article key={`${s.id}-${j}`} className={selected===s.id?"row-selected":""} onClick={()=>{}}><span>{++n}</span><div><b>VF40 extrusion</b><small>{j===0?"45°":"90°"} / {j===a.length-1?"45°":"90°"} end cuts</small></div><label><input type="number" value={length} onChange={e=>changeLength(s.id,Number(e.target.value))}/><i>mm</i></label></article>)}</div>}
function Bom({takeoff}:{takeoff:ReturnType<typeof preparePricingTakeoff>}){return <div className="data"><h3>Pricing line items</h3><p>Prepared separately from canvas geometry.</p><article><span>{takeoff.cutPieces.length}</span><div><b>VivaFrame extrusion</b><small>{takeoff.profileId} · {takeoff.finishId}</small></div><em className="unmapped">Mapping required</em></article>{takeoff.accessories.map(a=><article key={a.mappingKey}><span>{a.quantity}</span><div><b>{a.mappingKey.replaceAll("_"," ")}</b><small>Canonical Pricing Engine ID required</small></div><em className="unmapped">Unmapped</em></article>)}<div className="blocked">Complete price blocked until required APP mappings are configured.</div></div>}
