"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type SetStateAction } from "react";
import { addBoundarySegment, crossBracePieces, Design, Heading, historyFor, pointsFor, prepareFrameTakeoffForDesigns, removeBoundarySegment, splitForStock, summaryForDesigns, type BraceConfig, type BracePiece } from "../lib/geometry";
import { connectFramePricing, disconnectFramePricing, loginFramePricing, pricingUsername, quoteFrame, type FramePricingConfig, type FramePricingQuote } from "../lib/pricing-client";

type Tab = "summary" | "cuts" | "bom";
type PricingState = "connecting" | "ready" | "loading" | "error" | "disconnected";
const blankDesign = ():Design => ({start:{x:0,y:0},initialHeading:null,segments:[]});
const formatMoney = (amount:number, currency="AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount);

export default function Designer() {
  const [designs, setDesigns] = useState<Design[]>(() => [blankDesign()]);
  const [activeSeries, setActiveSeries] = useState(0);
  const [startPlaced, setStartPlaced] = useState(false);
  const [direction, setDirection] = useState<Heading | null>(null);
  const [nextLength, setNextLength] = useState(1000);
  const [editingDimension, setEditingDimension] = useState<string | null>(null);
  const [dimensionDraft, setDimensionDraft] = useState("");
  const [selected, setSelected] = useState("");
  const [selectedEnd, setSelectedEnd] = useState<"start" | "end" | null>(null);
  const [selectionNotice, setSelectionNotice] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [profile, setProfile] = useState("vivaframe-ss25");
  const [quantity, setQuantity] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [canvasOrigin, setCanvasOrigin] = useState({x:310,y:210});
  const [snap, setSnap] = useState(true);
  const [additionHistory, setAdditionHistory] = useState<("start"|"end")[]>([]);
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [pricing, setPricing] = useState<PricingState>("connecting");
  const [pricingError, setPricingError] = useState("");
  const [quote, setQuote] = useState<FramePricingQuote|null>(null);
  const [pricingConfig, setPricingConfig] = useState<FramePricingConfig|null>(null);
  const [pricingUser, setPricingUser] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [newSeriesOpen, setNewSeriesOpen] = useState(false);
  const [seriesX, setSeriesX] = useState(0);
  const [seriesY, setSeriesY] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const lengthRef = useRef<HTMLInputElement>(null);
  const design = designs[activeSeries] ?? designs[0];
  const setDesign = useCallback((update:SetStateAction<Design>)=>setDesigns(current=>current.map((item,index)=>index===activeSeries?(typeof update==="function"?(update as (value:Design)=>Design)(item):update):item)),[activeSeries]);
  const stats = useMemo(() => summaryForDesigns(designs), [designs]);
  const activeStats = useMemo(() => summaryForDesigns([design]), [design]);
  const points = useMemo(() => pointsFor(design), [design]);
  const seriesPoints = useMemo(() => designs.map(pointsFor), [designs]);
  const segmentCount = useMemo(() => designs.reduce((total,item)=>total+item.segments.length,0), [designs]);
  const eligibleExtrusions = useMemo(() => pricingConfig?.eligibleExtrusions ?? [], [pricingConfig]);
  const selectedExtrusion = eligibleExtrusions.find((row) => row.id === profile);
  const profileLabel = selectedExtrusion?.label ?? "VivaFrame extrusion";
  const hBraceExtrusion = pricingConfig?.extrusions.find(row=>row.extrusion.toLowerCase()==="h brace");
  const miniBraceExtrusion = pricingConfig?.extrusions.find(row=>row.extrusion.toLowerCase()==="mini brace");
  const braceConfig = useMemo<BraceConfig>(()=>({horizontalSpacing:selectedExtrusion?.source?.horizontalCrossBraceSpacing??null,verticalSpacing:selectedExtrusion?.source?.verticalCrossBraceSpacing??null,braceOffset:selectedExtrusion?.source?.braceOffset??0,hBraceWidth:hBraceExtrusion?.height??0,miniBraceWidth:miniBraceExtrusion?.height??0}),[selectedExtrusion,hBraceExtrusion,miniBraceExtrusion]);
  const bracePiecesBySeries = useMemo(()=>designs.map(item=>crossBracePieces(item,braceConfig)),[designs,braceConfig]);
  const takeoff = useMemo(() => prepareFrameTakeoffForDesigns(designs, profile, "configured",quantity,braceConfig), [designs, profile, quantity, braceConfig]);
  const applyPricingConfig=useCallback((config:FramePricingConfig)=>{setPricingConfig(config);setProfile(current=>{const legacy:Record<string,string>={ss25:"vivaframe-ss25",vf40:"vivaframe-ds40"},candidate=legacy[current]??current;return config.eligibleExtrusions.some(row=>row.id===candidate)?candidate:config.eligibleExtrusions[0]?.id??current})},[]);
  useEffect(()=>{connectFramePricing(applyPricingConfig).then(connected=>{setPricingUser(connected?pricingUsername():"");setPricing(connected?"ready":"disconnected")}).catch(error=>{setPricingError(error instanceof Error?error.message:"Pricing Engine is unavailable.");setPricingConfig(null);setPricingUser("");setPricing("error")})},[applyPricingConfig]);
  const connectPricing=useCallback(()=>{setLoginError("");setLoginOpen(true)},[]);
  const submitPricingLogin=useCallback(async(e:React.FormEvent)=>{e.preventDefault();setPricing("connecting");setLoginError("");try{const username=await loginFramePricing(loginUsername,loginPassword,applyPricingConfig);setPricingUser(username);setLoginPassword("");setLoginOpen(false);setPricing("ready")}catch(error){setLoginError(error instanceof Error?error.message:"Pricing Engine is unavailable.");setPricing("disconnected")}},[applyPricingConfig,loginUsername,loginPassword]);
  const disconnectPricing=useCallback(()=>{disconnectFramePricing();setPricingConfig(null);setPricingUser("");setQuote(null);setPricingError("");setPricing("disconnected")},[]);
  const recalculate=useCallback(async()=>{if(!stats.closed||!pricingConfig)return;setPricing("loading");setPricingError("");try{setQuote(await quoteFrame(takeoff));setPricing("ready")}catch(error){setQuote(null);setPricingError(error instanceof Error?error.message:"Pricing Engine is unavailable.");setPricing("error")}},[pricingConfig,stats.closed,takeoff]);
  useEffect(()=>{if(!stats.closed||!pricingConfig)return;const timer=window.setTimeout(()=>{void recalculate()},400);return()=>window.clearTimeout(timer)},[recalculate,stats.closed,pricingConfig]);
  const sx = .1 * zoom;
  const xy = (p:{x:number;y:number}) => ({x:canvasOrigin.x+(p.x-designs[0].start.x)*sx,y:canvasOrigin.y+(p.y-designs[0].start.y)*sx});
  function segmentClipPolygon(index:number,half=14){
    const a=xy(points[index]),b=xy(points[index+1]),length=Math.hypot(b.x-a.x,b.y-a.y)||1,u={x:(b.x-a.x)/length,y:(b.y-a.y)/length},n={x:-u.y,y:u.x};
    let startTurn=0,endTurn=0;
    if(index>0||activeStats.closed){const previous=xy(points[index>0?index-1:points.length-2]),previousLength=Math.hypot(a.x-previous.x,a.y-previous.y)||1,previousUnit={x:(a.x-previous.x)/previousLength,y:(a.y-previous.y)/previousLength};startTurn=previousUnit.x*u.y-previousUnit.y*u.x}
    if(index<design.segments.length-1||activeStats.closed){const following=xy(points[index<design.segments.length-1?index+2:1]),followingLength=Math.hypot(following.x-b.x,following.y-b.y)||1,followingUnit={x:(following.x-b.x)/followingLength,y:(following.y-b.y)/followingLength};endTurn=u.x*followingUnit.y-u.y*followingUnit.x}
    const point=(base:CanvasPoint,side:number,along:number)=>`${base.x+n.x*half*side+u.x*half*along},${base.y+n.y*half*side+u.y*half*along}`;
    return [point(a,1,startTurn),point(b,1,-endTurn),point(b,-1,endTurn),point(a,-1,-startTurn)].join(" ");
  }

  function changeSeriesLength(seriesIndex:number,id:string,length:number){setDesigns(current=>current.map((item,index)=>index===seriesIndex?{...item,segments:item.segments.map(segment=>segment.id===id?{...segment,length:Math.max(1,Math.round(length))}:segment)}:item))}
  function changeLength(id:string, length:number) { changeSeriesLength(activeSeries,id,length); }
  function selectSegment(id:string){setSelected(id);setSelectedEnd(null);setSelectionNotice("")}
  function selectSeriesSegment(seriesIndex:number,id:string){setActiveSeries(seriesIndex);setSelected(id);setSelectedEnd(null);setSelectionNotice("");setAdditionHistory([])}
  function selectEnd(boundary:"start"|"end"){setSelected("");setSelectedEnd(boundary);setSelectionNotice("")}
  function chooseDirection(value:Heading){setDirection(value);requestAnimationFrame(()=>{lengthRef.current?.focus();lengthRef.current?.select()})}
  function addSegment() { if(!startPlaced||!direction||nextLength<=0)return; const boundary:"start"|"end"=design.segments.length&&selectedEnd==="start"?"start":"end",id=`s${Date.now()}-${activeSeries}`,nextDesign=addBoundarySegment(design,boundary,direction,nextLength,id),nextDesigns=designs.map((item,index)=>index===activeSeries?nextDesign:item);setDesigns(nextDesigns);fitDesigns(nextDesigns);setAdditionHistory(h=>[...h,boundary]);setSelected("");setSelectedEnd(boundary);setSelectionNotice("");setDirection(null); }
  function beginDimensionEdit(id:string,length:number){selectSegment(id);setEditingDimension(id);setDimensionDraft(String(length));}
  function commitDimensionEdit(){if(editingDimension){const value=Number(dimensionDraft);if(Number.isFinite(value)&&value>0)changeLength(editingDimension,value)}setEditingDimension(null)}
  function undo(){ if(design.segments.length){const boundary=additionHistory.at(-1)??"end";setDesign(d=>removeBoundarySegment(d,boundary));setAdditionHistory(h=>h.slice(0,-1));setSelected("");setSelectedEnd(boundary);setSelectionNotice("")} }
  function deleteSelection(){
    if(!design.segments.length)return;
    let boundary=selectedEnd;
    if(!boundary&&selected){const index=design.segments.findIndex(segment=>segment.id===selected);if(index===0)boundary="start";else if(index===design.segments.length-1)boundary="end";else if(index>=0){setSelectionNotice("Only the first or last segment in the sequence can be deleted.");return}}
    if(!boundary)return;
    const nextDesign=removeBoundarySegment(design,boundary),nextSelected=boundary==="start"?nextDesign.segments[0]?.id:nextDesign.segments.at(-1)?.id;
    setDesign(nextDesign);setAdditionHistory([]);setSelected(nextSelected??"");setSelectedEnd(nextSelected?null:"end");setSelectionNotice("");setEditingDimension(null);setDirection(null);
  }
  function placeStart(e:ReactMouseEvent<SVGSVGElement>){
    if(activeSeries!==0||design.segments.length)return;
    const svg=e.currentTarget,rect=svg.getBoundingClientRect(),point=svg.createSVGPoint();
    const localX=e.clientX-rect.left,localY=e.clientY-rect.top,grid=20;
    point.x=rect.left+rect.width/2+Math.round((localX-rect.width/2)/grid)*grid;
    point.y=rect.top+rect.height/2+Math.round((localY-rect.height/2)/grid)*grid;
    const placed=point.matrixTransform(svg.getScreenCTM()!.inverse());
    setDesigns([{...blankDesign(),start:{x:0,y:0}}]);setActiveSeries(0);setCanvasOrigin({x:placed.x,y:placed.y});setStartPlaced(true);setSelectedEnd("end");setSelectionNotice("");setAdditionHistory([]);
  }
  function addSeries(){
    if(!startPlaced)return;
    const base=designs[0].start,newDesign:Design={start:{x:base.x+Math.round(seriesX),y:base.y+Math.round(seriesY)},initialHeading:null,segments:[]},next=[...designs,newDesign];
    setDesigns(next);setActiveSeries(next.length-1);setNewSeriesOpen(false);setSelected("");setSelectedEnd("end");setDirection(null);setAdditionHistory([]);fitDesigns(next);
  }
  function fitDesigns(targets:Design[]){
    const targetPoints=targets.flatMap(pointsFor);if(!targetPoints.length){setZoom(1);setCanvasOrigin({x:310,y:210});return}
    const minX=Math.min(...targetPoints.map(p=>p.x)),maxX=Math.max(...targetPoints.map(p=>p.x)),minY=Math.min(...targetPoints.map(p=>p.y)),maxY=Math.max(...targetPoints.map(p=>p.y));
    const scale=Math.min(.2,420/Math.max(maxX-minX,1),275/Math.max(maxY-minY,1)),nextZoom=Math.max(.25,Math.min(2,scale/.1)),effectiveScale=.1*nextZoom;
    setZoom(nextZoom);setCanvasOrigin({x:310-((minX+maxX)/2-targets[0].start.x)*effectiveScale,y:210-((minY+maxY)/2-targets[0].start.y)*effectiveScale});
  }
  function fitFrame(){fitDesigns(designs)}
  useEffect(()=>{ const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(["INPUT","SELECT","TEXTAREA"].includes(target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}else if(e.key==="Delete"){e.preventDefault();deleteSelection()}else if(e.key==="ArrowLeft")setDirection("W");else if(e.key==="ArrowUp")setDirection("N");else if(e.key==="ArrowRight")setDirection("E");else if(e.key==="ArrowDown")setDirection("S");else if(e.key==="Enter")addSegment();}; window.addEventListener("keydown",key); return()=>window.removeEventListener("keydown",key); });
  function exportDesign(){ const a=document.createElement("a"),blob=new Blob([JSON.stringify({schemaVersion:3,name:"Reception display frame",designs,productIds:{profile}},null,2)],{type:"application/json"});a.href=URL.createObjectURL(blob);a.download="vivaframe-design.json";a.click();URL.revokeObjectURL(a.href); }
  async function importDesign(file?:File){if(!file)return;const data=JSON.parse(await file.text()),imported:Design[]=data.designs??[data.design];setDesigns(imported);setActiveSeries(0);setStartPlaced(true);setCanvasOrigin({x:310,y:210});setAdditionHistory([]);setSelectedEnd("end");setProfile(data.productIds?.profile||"vivaframe-ss25");fitDesigns(imported);}

  return <div className="shell">
    <header className="productbar"><div className="brand"><Image src="/vivad-logo.png" alt="Vivad" width={118} height={32} unoptimized priority/><span/><div><h1>VivaFrame Designer</h1><small>Frame configuration</small></div></div><div className="actions"><button onClick={()=>{setDesigns([blankDesign()]);setActiveSeries(0);setStartPlaced(false);setCanvasOrigin({x:310,y:210});setAdditionHistory([]);setSelected("");setSelectedEnd(null);setSelectionNotice("");setDirection(null)}}>＋ New design</button><button onClick={()=>setSaved(true)}>▣ Save design</button><button onClick={exportDesign}>⇩ Export design</button><button onClick={()=>fileRef.current?.click()}>⇧ Import design</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={e=>importDesign(e.target.files?.[0])}/></div></header>
    {saved&&<div className="toast" role="status"><b>✓</b><span><strong>Design saved</strong><small>Reception display frame</small></span><button onClick={()=>setSaved(false)} aria-label="Dismiss">×</button></div>}
    {loginOpen&&<div className="login-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLoginOpen(false)}}><form className="pricing-login" onSubmit={submitPricingLogin}><button type="button" className="login-close" aria-label="Close pricing login" onClick={()=>setLoginOpen(false)}>×</button><span className="login-kicker">SECURE PRICING CONNECTION</span><h2>Connect to Pricing Engine</h2><p>Use the same username and password as SAV Builder. Your password is sent directly to the Pricing Engine and is never stored by this app.</p><label>Username<input autoFocus autoComplete="username" value={loginUsername} onChange={e=>setLoginUsername(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required/></label>{loginError&&<div className="login-error" role="alert">{loginError}</div>}<button className="primary" type="submit" disabled={pricing==="connecting"}>{pricing==="connecting"?"Connecting…":"Connect securely"}</button></form></div>}
    <main className="layout">
      <aside className="config">
        <div className="panel-title"><span>VF</span><div><h1>VivaFrame Designer</h1><small>Frame configuration</small></div></div>
        <Section title="Design"><label>Short name<input defaultValue="Reception display frame"/></label><label>Quantity<input type="number" min="1" value={quantity} onChange={e=>setQuantity(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label><div className="series-summary"><span>{designs.length} {designs.length===1?"series":"series"}</span><b>Editing series {activeSeries+1}</b></div><button className="new-series" onClick={()=>setNewSeriesOpen(value=>!value)} disabled={!startPlaced}>＋ Start separate series</button>{newSeriesOpen&&<form className="series-form" onSubmit={e=>{e.preventDefault();addSeries()}}><p>Starting point relative to series 1</p><div><label>X coordinate<input type="number" value={seriesX} onChange={e=>setSeriesX(Number(e.target.value))}/><span>mm</span></label><label>Y coordinate<input type="number" value={seriesY} onChange={e=>setSeriesY(Number(e.target.value))}/><span>mm</span></label></div><small>Positive X moves right. Positive Y moves down.</small><button className="primary" type="submit">Create series</button></form>}</Section>
        <Section title="Material"><label>Extrusion<select value={profile} onChange={e=>setProfile(e.target.value)} disabled={!eligibleExtrusions.length}>{!eligibleExtrusions.length&&<option value="vivaframe-ss25">Connect pricing to load eligible extrusions</option>}{eligibleExtrusions.map(row=><option key={row.id} value={row.id}>{row.label}{row.source?"":" — pricing setup required"}</option>)}</select></label>{selectedExtrusion?.source?<p className="material-detail">{selectedExtrusion.source.width} × {selectedExtrusion.source.height} mm · {selectedExtrusion.source.weight} kg/m</p>:<p className="material-detail">Connect to the Pricing Engine to load the configured extrusion list.</p>}</Section>
        <Section title={`Next segment · series ${activeSeries+1}`}><p className="instruction">{!startPlaced?"Click any grid point to place the start.":activeStats.closed?"Series closed. Select either end to extend it.":`Adding at the ${selectedEnd==="start"?"start":"end"}. Choose a direction, type the length and press Enter.`}</p><div className="directions">{([["N","↑","Up"],["W","←","Left"],["E","→","Right"],["S","↓","Down"]] as [Heading,string,string][]).map(([value,arrow,label])=><button key={value} className={`dir-${value.toLowerCase()} ${direction===value?"chosen":""}`} onClick={()=>chooseDirection(value)} disabled={!startPlaced}><b>{arrow}</b>{label}</button>)}</div><label className="next-length">Length<input ref={lengthRef} type="number" min="1" step={snap?50:1} value={nextLength} onChange={e=>setNextLength(Number(e.target.value))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addSegment()}}}/><span>mm</span></label><button className="add-segment" onClick={addSegment} disabled={!startPlaced||!direction||nextLength<=0}>Add segment at {selectedEnd==="start"?"start":"end"}</button><button className="undo" onClick={undo}>↶ Undo last segment <kbd>⌘Z</kbd></button></Section>
      </aside>
      <section className="stage">
        <div className="stage-head"><div><h2>Build Preview</h2><span className={stats.closed?"success":"open-status"}>{stats.closed?`✓ ${designs.length} closed ${designs.length===1?"series":"series"}`:startPlaced?`Series ${activeSeries+1} open`:"Place start point"}</span></div><div className="tools"><button onClick={()=>setZoom(z=>Math.min(2,z+.1))}>＋</button><button onClick={()=>setZoom(z=>Math.max(.25,z-.1))}>−</button><button onClick={fitFrame}>Fit frame</button><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/><i/>Snap 50 mm</label></div></div>
        <div className={`canvas ${snap?"grid":""}`}>
          <svg viewBox="0 0 620 420" className={!startPlaced?"placing":""} onClick={placeStart} role={startPlaced?"img":"button"} tabIndex={!startPlaced?0:undefined} aria-label={startPlaced?`${designs.length} series frame ${stats.width} by ${stats.height} millimetres`:"Click a grid point to place the starting point"}>
            {startPlaced&&<>
            {designs.map((series,seriesIndex)=>seriesIndex===activeSeries?null:<g key={`series-${seriesIndex}`} className="inactive-series">{bracePiecesBySeries[seriesIndex].map(piece=><BraceDrawing key={piece.id} piece={piece} xy={xy} frameProfileHeight={selectedExtrusion?.source?.height??0}/>)}{series.segments.map((segment,index)=>{const seriesPath=seriesPoints[seriesIndex],a=xy(seriesPath[index]),b=xy(seriesPath[index+1]);return <g key={segment.id} onClick={e=>{e.stopPropagation();selectSeriesSegment(seriesIndex,segment.id)}}><line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="rail" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="face" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/></g>})}<circle className="series-point" cx={xy(series.start).x} cy={xy(series.start).y} r="5"/></g>)}
            <defs>{design.segments.map((s,i)=><clipPath key={s.id} id={`segment-clip-${s.id}`} clipPathUnits="userSpaceOnUse"><polygon points={segmentClipPolygon(i)}/></clipPath>)}</defs>
            {bracePiecesBySeries[activeSeries].map(piece=><BraceDrawing key={piece.id} piece={piece} xy={xy} frameProfileHeight={selectedExtrusion?.source?.height??0}/>)}
            {design.segments.map((s,i)=>{const a=xy(points[i]),b=xy(points[i+1]),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,len=Math.hypot(b.x-a.x,b.y-a.y)||1,ox=-(b.y-a.y)/len,oy=(b.x-a.x)/len;return <g key={s.id} className={selected===s.id?"selected":""} onClick={()=>selectSegment(s.id)}><line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><g clipPath={`url(#segment-clip-${s.id})`}><line className="rail" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="face" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="profile-highlight" x1={a.x+ox*5} y1={a.y+oy*5} x2={b.x+ox*5} y2={b.y+oy*5}/><line className="profile-groove" x1={a.x-ox*3} y1={a.y-oy*3} x2={b.x-ox*3} y2={b.y-oy*3}/></g>{editingDimension===s.id?<foreignObject x={mx-48} y={my-18} width="96" height="36" onClick={e=>e.stopPropagation()}><input className="dimension-edit" autoFocus inputMode="numeric" value={dimensionDraft} onChange={e=>setDimensionDraft(e.target.value)} onBlur={commitDimensionEdit} onKeyDown={e=>{if(e.key==="Enter")commitDimensionEdit();if(e.key==="Escape")setEditingDimension(null)}} aria-label={`Edit segment ${i+1} length in millimetres`}/></foreignObject>:<g className="dimension-label" transform={`translate(${mx} ${my})`} onClick={e=>{e.stopPropagation();beginDimensionEdit(s.id,s.length)}} role="button" tabIndex={0} aria-label={`Edit ${s.length} millimetre dimension`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();beginDimensionEdit(s.id,s.length)}}}><rect x="-38" y="-13" width="76" height="26" rx="4"/><text dy="4" textAnchor="middle">{s.length} mm</text></g>}</g>})}
            {design.segments.slice(1).map((_,i)=>{const index=i+1;return <CornerHardware key={`corner-${index}`} point={xy(points[index])} before={xy(points[index-1])} after={xy(points[index+1])}/>})}
            {activeStats.closed&&<CornerHardware point={xy(points[0])} before={xy(points.at(-2)!)} after={xy(points[1])}/>}
            {points.map((p,i)=>{const q=xy(p),isStart=i===0,isEnd=i===points.length-1&&points.length>1;if(isStart||isEnd){const endType:"start"|"end"=isEnd||points.length===1?"end":"start";return <g key={i} className={`selectable-point ${selectedEnd===endType?"point-selected":""}`} onClick={e=>{e.stopPropagation();selectEnd(endType)}} role="button" tabIndex={0} aria-label={`Select ${points.length===1?"starting":endType} point`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectEnd(endType)}}}><circle className="point-hit" cx={q.x} cy={q.y} r="16"/><circle cx={q.x} cy={q.y} r="8" className={isStart?"start":"current"}/></g>}return <circle key={i} cx={q.x} cy={q.y} r="4" className="joint"/>})}
            </>}
          </svg>
          {!startPlaced&&<div className="place">＋ Click any grid intersection to place the starting point</div>}
          {startPlaced&&!design.segments.length&&<div className="reposition-hint">{activeSeries===0?"Click another grid point to reposition the start":`Series ${activeSeries+1} start placed · choose a direction`}</div>}
          <div className="legend"><span><i className="start-dot"/>Unselected end</span><span><i className="current-dot"/>Selected end</span><span className="profile-key">{profileLabel}</span></div>
        </div>
        <div className="stage-foot"><span className={selectionNotice?"selection-error":""}>{selectionNotice||(selectedEnd?`Series ${activeSeries+1} ${selectedEnd==="start"?"start":"end"} selected · New segments extend here.`:selected?`Series ${activeSeries+1} segment selected · Delete repeatedly removes toward the centre.`:`Series ${activeSeries+1} · orthogonal drawing · dimensions in millimetres`)}</span><b>{Math.round(zoom*100)}%</b></div>
        <section className="history"><button onClick={()=>setHistoryOpen(v=>!v)}><span><b>Construction history · series {activeSeries+1}</b><small>Generated from the selected series</small></span>{historyOpen?"⌄":"⌃"}</button>{historyOpen&&<div>{historyFor(design).map((line,i)=><code key={i}><em>{String(i+1).padStart(2,"0")}</em>{line}</code>)}</div>}</section>
      </section>
      <aside className="results">
        <div className="tabs" role="tablist">{(["summary","cuts","bom"] as Tab[]).map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t==="summary"?"Summary":t==="cuts"?"Cut list":"BOM"}</button>)}</div>
        {tab==="summary"&&<Summary stats={stats} count={segmentCount} seriesCount={designs.length} pricing={pricing} pricingError={pricingError} quote={quote} connected={!!pricingConfig} username={pricingUser} onConnect={connectPricing} onDisconnect={disconnectPricing} onRecalculate={recalculate}/>}
        {tab==="cuts"&&<CutList designs={designs} bracePiecesBySeries={bracePiecesBySeries} activeSeries={activeSeries} selected={selected} profileLabel={profileLabel} changeLength={changeSeriesLength}/>}
        {tab==="bom"&&<Bom takeoff={takeoff} profileLabel={profileLabel} quote={quote}/>}
      </aside>
    </main>
  </div>;
}

type CanvasPoint = {x:number;y:number};
function BraceDrawing({piece,xy,frameProfileHeight}:{piece:BracePiece;xy:(point:{x:number;y:number})=>CanvasPoint;frameProfileHeight:number}){
  const start=xy(piece.start),end=xy(piece.end),frameDisplayWidth=19,strokeWidth=frameProfileHeight>0?frameDisplayWidth*piece.widthMm/frameProfileHeight:2;
  return <g className={`cross-brace ${piece.kind}`} aria-label={`${piece.kind==="h-brace"?"H Brace":"Mini Brace"} ${piece.lengthMm} millimetres`}><line x1={start.x} y1={start.y} x2={end.x} y2={end.y} style={{strokeWidth}}/><circle cx={start.x} cy={start.y} r="2.5"/><circle cx={end.x} cy={end.y} r="2.5"/></g>;
}
function CornerHardware({point,before,after}:{point:CanvasPoint;before:CanvasPoint;after:CanvasPoint}){
  const unit=(target:CanvasPoint)=>{const dx=target.x-point.x,dy=target.y-point.y,length=Math.hypot(dx,dy)||1;return {x:dx/length,y:dy/length}},incoming=unit(before),outgoing=unit(after);
  if(Math.abs(incoming.x*outgoing.x+incoming.y*outgoing.y)>.15)return null;
  const bisectorLength=Math.hypot(incoming.x+outgoing.x,incoming.y+outgoing.y)||1,bisector={x:(incoming.x+outgoing.x)/bisectorLength,y:(incoming.y+outgoing.y)/bisectorLength},arms=[incoming,outgoing];
  return <g className="corner-hardware" aria-hidden="true">
    <line className="mitre-seam" x1={point.x-bisector.x*9} y1={point.y-bisector.y*9} x2={point.x+bisector.x*9} y2={point.y+bisector.y*9}/>
    {arms.map((arm,index)=><line key={`plate-${index}`} className="corner-plate" x1={point.x+arm.x*7+bisector.x*3} y1={point.y+arm.y*7+bisector.y*3} x2={point.x+arm.x*34+bisector.x*3} y2={point.y+arm.y*34+bisector.y*3}/>) }
    {arms.flatMap((arm,index)=>[17,28].map(distance=><circle key={`fixing-${index}-${distance}`} className="corner-fixing" cx={point.x+arm.x*distance+bisector.x*3} cy={point.y+arm.y*distance+bisector.y*3} r="2.2"/>))}
  </g>;
}

function Section({title,children}:{title:string;children:React.ReactNode}){return <section><h2>{title}</h2>{children}</section>}
function Summary({stats,count,seriesCount,pricing,pricingError,quote,connected,username,onConnect,onDisconnect,onRecalculate}:{stats:ReturnType<typeof summaryForDesigns>;count:number;seriesCount:number;pricing:PricingState;pricingError:string;quote:FramePricingQuote|null;connected:boolean;username:string;onConnect:()=>void;onDisconnect:()=>void;onRecalculate:()=>void}){
  const status = pricing === "connecting" ? ["Connecting to Pricing Engine", "Validating your secure session."] : pricing === "error" ? ["Pricing context is not connected", pricingError||"Connect again to continue."] : connected ? ["Pricing Engine connected", stats.closed ? `Connected as ${username}. Current pricing is ready.` : `Connected as ${username}. Complete the frame to calculate current pricing.`] : ["Pricing context is not connected", "Connect with the same account you use for SAV Builder."];
  return <>
    <div className={stats.closed?"complete":"frame-progress"}><span>{stats.closed?"✓":"＋"}</span><div><b>{stats.closed?"Frame is complete":count?"Frame is open":"Ready to draw"}</b><small>{stats.closed?"All segments form a closed path.":count?"Add segments until the current point returns to the start.":"Place a start point, choose a direction and enter a length."}</small></div></div>
    <Section title="Frame summary"><dl>{[["Segment series",seriesCount],["Overall width",`${stats.width.toLocaleString()} mm`],["Overall height",`${stats.height.toLocaleString()} mm`],["Total perimeter",`${stats.perimeter.toLocaleString()} mm`],["Extrusion pieces",count],["90° corners",stats.corners],["45° mitre cuts",stats.mitres]].map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl></Section>
    <Section title="Stock estimate"><div className="stock"><b>{stats.stock}</b><span><strong>× 5,600 mm lengths</strong><small>Estimated stock requirement</small></span></div><div className="waste"><span>Estimated material waste</span><b>{stats.waste.toLocaleString()} mm</b><i><em style={{width:stats.stock?`${Math.max(3,stats.waste/(stats.stock*5600)*100)}%`:"0%"}}/></i></div></Section>
    <Section title="Pricing">
      {quote && typeof quote.total === "number" ? <div className="quoted"><small>Calculated total</small><strong>{formatMoney(quote.total, quote.currency)}</strong></div> : <div className={`pricing-state ${pricing === "error" ? "pricing-error" : ""}`}><b>{pricing === "connecting" ? "…" : pricing === "error" ? "!" : "i"}</b><span><strong>{status[0]}</strong><small>{status[1]}</small></span></div>}
      {!connected?<button className="primary" onClick={onConnect} disabled={pricing==="connecting"}>{pricing==="connecting"?"Connecting…":"Connect pricing"}</button>:<><button className="primary" onClick={onRecalculate} disabled={!stats.closed||pricing==="loading"}>{pricing === "loading" ? "Calculating…" : "Recalculate price"}</button><button className="disconnect" onClick={onDisconnect}>Disconnect {username}</button></>}
      {quote?.calculatedAt&&<p className="last">Last calculated {new Date(quote.calculatedAt).toLocaleString("en-AU")}</p>}
    </Section>
  </>;
}
function CutList({designs,bracePiecesBySeries,activeSeries,selected,profileLabel,changeLength}:{designs:Design[];bracePiecesBySeries:BracePiece[][];activeSeries:number;selected:string;profileLabel:string;changeLength:(seriesIndex:number,id:string,n:number)=>void}){let n=0;return <div className="data"><h3>Manufacturable pieces</h3><p>Finished outside / long-point measurements, followed by calculated brace cuts.</p>{designs.flatMap((design,seriesIndex)=>design.segments.flatMap(s=>splitForStock(s.length).map((length,j,a)=>({s,length,j,a,seriesIndex})))).map(({s,length,j,a,seriesIndex})=><article key={`${seriesIndex}-${s.id}-${j}`} className={seriesIndex===activeSeries&&selected===s.id?"row-selected":""}><span>{++n}</span><div><b>{profileLabel}</b><small>Series {seriesIndex+1} · {j===0?"45°":"90°"} / {j===a.length-1?"45°":"90°"} end cuts</small></div><label><input type="number" value={length} onChange={e=>changeLength(seriesIndex,s.id,Number(e.target.value))}/><i>mm</i></label></article>)}{bracePiecesBySeries.flatMap((pieces,seriesIndex)=>pieces.map(piece=>({piece,seriesIndex}))).map(({piece,seriesIndex})=><article key={`brace-${seriesIndex}-${piece.id}`}><span>{++n}</span><div><b>{piece.kind==="h-brace"?"H Brace":"Mini Brace"}</b><small>Series {seriesIndex+1} · {piece.orientation} · 90° / 90° end cuts</small></div><label><input type="number" value={piece.lengthMm} readOnly aria-label={`${piece.kind==="h-brace"?"H Brace":"Mini Brace"} cut length`}/><i>mm</i></label></article>)}</div>}
function Bom({takeoff,profileLabel,quote}:{takeoff:ReturnType<typeof prepareFrameTakeoffForDesigns>;profileLabel:string;quote:FramePricingQuote|null}){const hBraces=takeoff.bracePieces.filter(piece=>piece.kind==="h-brace"),miniBraces=takeoff.bracePieces.filter(piece=>piece.kind==="mini-brace"),locks=takeoff.bracePieces.length*2,currency=quote?.currency??"AUD",lines=quote?.lines??[];return <div className="data"><h3>Bill of materials</h3><p>{lines.length?"Authoritative component pricing from the Pricing Engine.":"Calculated directly from all segment series. Complete the frame and connect pricing to see rates."}</p>{lines.length?<> {lines.map(line=><article className="bom-priced" key={line.key}><span>{Number.isInteger(line.quantity)?line.quantity:line.quantity.toLocaleString("en-AU",{maximumFractionDigits:3})}</span><div><b>{line.description}</b><small>{line.unit}</small></div><div className="bom-price"><small>{formatMoney(line.unitPrice,currency)} / {line.unit}</small><strong>{formatMoney(line.total,currency)}</strong></div></article>)}<div className="bom-totals"><div><span>Subtotal</span><b>{formatMoney(quote?.subtotal??0,currency)}</b></div>{(quote?.discount??0)>0&&<div><span>Discount{quote?.discountPercentage?` (${quote.discountPercentage}%)`:""}</span><b>−{formatMoney(quote?.discount??0,currency)}</b></div>}{(quote?.tax??0)>0&&<div><span>Tax</span><b>{formatMoney(quote?.tax??0,currency)}</b></div>}<div className="bom-grand-total"><span>Total</span><strong>{formatMoney(quote?.total??0,currency)}</strong></div></div></>:<><article><span>{takeoff.cutPieces.length}</span><div><b>{profileLabel}</b><small>{takeoff.profileId}</small></div><em className="bom-status">Required</em></article>{hBraces.length>0&&<article><span>{hBraces.length}</span><div><b>H Brace</b><small>{hBraces.reduce((sum,piece)=>sum+piece.lengthMm,0).toLocaleString()} mm total</small></div><em className="bom-status">Required</em></article>}{miniBraces.length>0&&<article><span>{miniBraces.length}</span><div><b>Mini Brace</b><small>{miniBraces.reduce((sum,piece)=>sum+piece.lengthMm,0).toLocaleString()} mm total</small></div><em className="bom-status">Required</em></article>}{locks>0&&<article><span>{locks}</span><div><b>Tension locks</b><small>Two per brace piece</small></div><em className="bom-status">Required</em></article>}{takeoff.accessories.map(a=><article key={a.mappingKey}><span>{a.quantity}</span><div><b>{a.mappingKey.replaceAll("_"," ")}</b><small>Frame hardware</small></div><em className="bom-status">Required</em></article>)}</>}</div>}
