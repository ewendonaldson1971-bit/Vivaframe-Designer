"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { addBoundarySegment, Design, Heading, historyFor, pointsFor, prepareFrameTakeoff, removeBoundarySegment, splitForStock, summary } from "../lib/geometry";
import { connectFramePricing, disconnectFramePricing, loginFramePricing, pricingUsername, quoteFrame, type FramePricingConfig, type FramePricingQuote } from "../lib/pricing-client";

type Tab = "summary" | "cuts" | "bom";
type PricingState = "connecting" | "ready" | "loading" | "error" | "disconnected";
const blankDesign = ():Design => ({start:{x:0,y:0},initialHeading:null,segments:[]});
const formatMoney = (amount:number, currency="AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount);

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
  const [profile, setProfile] = useState("vivaframe-ss25");
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
  const fileRef = useRef<HTMLInputElement>(null);
  const stats = useMemo(() => summary(design), [design]);
  const points = useMemo(() => pointsFor(design), [design]);
  const eligibleExtrusions = pricingConfig?.eligibleExtrusions ?? [];
  const selectedExtrusion = eligibleExtrusions.find((row) => row.id === profile);
  const profileLabel = selectedExtrusion?.label ?? "VivaFrame extrusion";
  const takeoff = useMemo(() => prepareFrameTakeoff(design, profile, "configured"), [design, profile]);
  useEffect(()=>{connectFramePricing(config=>setPricingConfig(config)).then(connected=>{setPricingUser(connected?pricingUsername():"");setPricing(connected?"ready":"disconnected")}).catch(error=>{setPricingError(error instanceof Error?error.message:"Pricing Engine is unavailable.");setPricingConfig(null);setPricingUser("");setPricing("error")})},[]);
  useEffect(()=>{if(!eligibleExtrusions.length)return;const legacy:Record<string,string>={ss25:"vivaframe-ss25",vf40:"vivaframe-ds40"},candidate=legacy[profile]??profile;if(eligibleExtrusions.some(row=>row.id===candidate)){if(candidate!==profile)setProfile(candidate)}else setProfile(eligibleExtrusions[0].id)},[eligibleExtrusions,profile]);
  const connectPricing=useCallback(()=>{setLoginError("");setLoginOpen(true)},[]);
  const submitPricingLogin=useCallback(async(e:React.FormEvent)=>{e.preventDefault();setPricing("connecting");setLoginError("");try{const username=await loginFramePricing(loginUsername,loginPassword,config=>setPricingConfig(config));setPricingUser(username);setLoginPassword("");setLoginOpen(false);setPricing("ready")}catch(error){setLoginError(error instanceof Error?error.message:"Pricing Engine is unavailable.");setPricing("disconnected")}},[loginUsername,loginPassword]);
  const disconnectPricing=useCallback(()=>{disconnectFramePricing();setPricingConfig(null);setPricingUser("");setQuote(null);setPricingError("");setPricing("disconnected")},[]);
  const recalculate=useCallback(async()=>{if(!stats.closed||!pricingConfig)return;setPricing("loading");setPricingError("");try{setQuote(await quoteFrame(takeoff));setPricing("ready")}catch(error){setQuote(null);setPricingError(error instanceof Error?error.message:"Pricing Engine is unavailable.");setPricing("error")}},[pricingConfig,stats.closed,takeoff]);
  useEffect(()=>{if(!stats.closed||!pricingConfig)return;const timer=window.setTimeout(()=>{void recalculate()},400);return()=>window.clearTimeout(timer)},[recalculate,stats.closed,pricingConfig]);
  const sx = .1 * zoom;
  const xy = (p:{x:number;y:number}) => ({x:canvasOrigin.x+(p.x-design.start.x)*sx,y:canvasOrigin.y+(p.y-design.start.y)*sx});
  function segmentClipPolygon(index:number,half=14){
    const a=xy(points[index]),b=xy(points[index+1]),length=Math.hypot(b.x-a.x,b.y-a.y)||1,u={x:(b.x-a.x)/length,y:(b.y-a.y)/length},n={x:-u.y,y:u.x};
    let startTurn=0,endTurn=0;
    if(index>0||stats.closed){const previous=xy(points[index>0?index-1:points.length-2]),previousLength=Math.hypot(a.x-previous.x,a.y-previous.y)||1,previousUnit={x:(a.x-previous.x)/previousLength,y:(a.y-previous.y)/previousLength};startTurn=previousUnit.x*u.y-previousUnit.y*u.x}
    if(index<design.segments.length-1||stats.closed){const following=xy(points[index<design.segments.length-1?index+2:1]),followingLength=Math.hypot(following.x-b.x,following.y-b.y)||1,followingUnit={x:(following.x-b.x)/followingLength,y:(following.y-b.y)/followingLength};endTurn=u.x*followingUnit.y-u.y*followingUnit.x}
    const point=(base:CanvasPoint,side:number,along:number)=>`${base.x+n.x*half*side+u.x*half*along},${base.y+n.y*half*side+u.y*half*along}`;
    return [point(a,1,startTurn),point(b,1,-endTurn),point(b,-1,endTurn),point(a,-1,-startTurn)].join(" ");
  }

  function changeLength(id:string, length:number) { setDesign(d => ({...d,segments:d.segments.map(s=>s.id===id?{...s,length:Math.max(1,Math.round(length))}:s)})); }
  function selectSegment(id:string){setSelected(id);setSelectedEnd(null);setSelectionNotice("")}
  function selectEnd(boundary:"start"|"end"){setSelected("");setSelectedEnd(boundary);setSelectionNotice("")}
  function addSegment() { if(!startPlaced||!direction||nextLength<=0)return; const boundary:"start"|"end"=design.segments.length&&selectedEnd==="start"?"start":"end",id=`s${Date.now()}`,nextDesign=addBoundarySegment(design,boundary,direction,nextLength,id);setDesign(nextDesign);fitDesign(nextDesign);setAdditionHistory(h=>[...h,boundary]);setSelected("");setSelectedEnd(boundary);setSelectionNotice("");setDirection(null); }
  function beginDimensionEdit(id:string,length:number){selectSegment(id);setEditingDimension(id);setDimensionDraft(String(length));}
  function commitDimensionEdit(){if(editingDimension){const value=Number(dimensionDraft);if(Number.isFinite(value)&&value>0)changeLength(editingDimension,value)}setEditingDimension(null)}
  function undo(){ if(design.segments.length){const boundary=additionHistory.at(-1)??"end";setDesign(d=>removeBoundarySegment(d,boundary));setAdditionHistory(h=>h.slice(0,-1));setSelected("");setSelectedEnd(boundary);setSelectionNotice("")} }
  function deleteSelection(){
    if(!design.segments.length)return;
    let boundary=selectedEnd;
    if(!boundary&&selected){const index=design.segments.findIndex(segment=>segment.id===selected);if(index===0)boundary="start";else if(index===design.segments.length-1)boundary="end";else if(index>=0){setSelectionNotice("Only the first or last segment in the sequence can be deleted.");return}}
    if(!boundary)return;
    setDesign(d=>removeBoundarySegment(d,boundary!));setAdditionHistory([]);setSelected("");setSelectedEnd(null);setSelectionNotice("");setEditingDimension(null);setDirection(null);
  }
  function placeStart(e:ReactMouseEvent<SVGSVGElement>){
    if(design.segments.length)return;
    const svg=e.currentTarget,rect=svg.getBoundingClientRect(),point=svg.createSVGPoint();
    const localX=e.clientX-rect.left,localY=e.clientY-rect.top,grid=20;
    point.x=rect.left+rect.width/2+Math.round((localX-rect.width/2)/grid)*grid;
    point.y=rect.top+rect.height/2+Math.round((localY-rect.height/2)/grid)*grid;
    const placed=point.matrixTransform(svg.getScreenCTM()!.inverse());
    setDesign(blankDesign());setCanvasOrigin({x:placed.x,y:placed.y});setStartPlaced(true);setSelectedEnd("end");setSelectionNotice("");setAdditionHistory([]);
  }
  function fitDesign(target:Design){
    if(!target.segments.length){setZoom(1);setCanvasOrigin({x:310,y:210});return}
    const targetPoints=pointsFor(target),minX=Math.min(...targetPoints.map(p=>p.x)),maxX=Math.max(...targetPoints.map(p=>p.x)),minY=Math.min(...targetPoints.map(p=>p.y)),maxY=Math.max(...targetPoints.map(p=>p.y));
    const scale=Math.min(.2,420/Math.max(maxX-minX,1),275/Math.max(maxY-minY,1)),nextZoom=Math.max(.25,Math.min(2,scale/.1)),effectiveScale=.1*nextZoom;
    setZoom(nextZoom);setCanvasOrigin({x:310-((minX+maxX)/2-target.start.x)*effectiveScale,y:210-((minY+maxY)/2-target.start.y)*effectiveScale});
  }
  function fitFrame(){fitDesign(design)}
  useEffect(()=>{ const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(["INPUT","SELECT","TEXTAREA"].includes(target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();undo()}else if(e.key==="Delete"){e.preventDefault();deleteSelection()}else if(e.key==="ArrowLeft")setDirection("W");else if(e.key==="ArrowUp")setDirection("N");else if(e.key==="ArrowRight")setDirection("E");else if(e.key==="ArrowDown")setDirection("S");else if(e.key==="Enter")addSegment();}; window.addEventListener("keydown",key); return()=>window.removeEventListener("keydown",key); });
  function exportDesign(){ const a=document.createElement("a"),blob=new Blob([JSON.stringify({schemaVersion:2,name:"Reception display frame",design,productIds:{profile}},null,2)],{type:"application/json"});a.href=URL.createObjectURL(blob);a.download="vivaframe-design.json";a.click();URL.revokeObjectURL(a.href); }
  async function importDesign(file?:File){if(!file)return;const data=JSON.parse(await file.text());setDesign(data.design);setStartPlaced(true);setCanvasOrigin({x:310,y:210});setAdditionHistory([]);setSelectedEnd("end");setProfile(data.productIds?.profile||"vivaframe-ss25");}

  return <div className="shell">
    <header className="productbar"><div className="brand"><Image src="/vivad-logo.png" alt="Vivad" width={118} height={32} unoptimized priority/><span/><div><h1>VivaFrame Designer</h1><small>Frame configuration</small></div></div><div className="actions"><button onClick={()=>{setDesign(blankDesign());setStartPlaced(false);setCanvasOrigin({x:310,y:210});setAdditionHistory([]);setSelected("");setSelectedEnd(null);setSelectionNotice("");setDirection(null)}}>＋ New design</button><button onClick={()=>setSaved(true)}>▣ Save design</button><button onClick={exportDesign}>⇩ Export design</button><button onClick={()=>fileRef.current?.click()}>⇧ Import design</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={e=>importDesign(e.target.files?.[0])}/></div></header>
    {saved&&<div className="toast" role="status"><b>✓</b><span><strong>Design saved</strong><small>Reception display frame</small></span><button onClick={()=>setSaved(false)} aria-label="Dismiss">×</button></div>}
    {loginOpen&&<div className="login-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLoginOpen(false)}}><form className="pricing-login" onSubmit={submitPricingLogin}><button type="button" className="login-close" aria-label="Close pricing login" onClick={()=>setLoginOpen(false)}>×</button><span className="login-kicker">SECURE PRICING CONNECTION</span><h2>Connect to Pricing Engine</h2><p>Use the same username and password as SAV Builder. Your password is sent directly to the Pricing Engine and is never stored by this app.</p><label>Username<input autoFocus autoComplete="username" value={loginUsername} onChange={e=>setLoginUsername(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required/></label>{loginError&&<div className="login-error" role="alert">{loginError}</div>}<button className="primary" type="submit" disabled={pricing==="connecting"}>{pricing==="connecting"?"Connecting…":"Connect securely"}</button></form></div>}
    <main className="layout">
      <aside className="config">
        <div className="panel-title"><span>VF</span><div><h1>VivaFrame Designer</h1><small>Frame configuration</small></div></div>
        <Section title="Design"><label>Short name<input defaultValue="Reception display frame"/></label><label>Quantity<input type="number" min="1" defaultValue="1"/></label></Section>
        <Section title="Material"><label>Extrusion<select value={profile} onChange={e=>setProfile(e.target.value)} disabled={!eligibleExtrusions.length}>{!eligibleExtrusions.length&&<option value="vivaframe-ss25">Connect pricing to load eligible extrusions</option>}{eligibleExtrusions.map(row=><option key={row.id} value={row.id}>{row.label}{row.source?"":" — pricing setup required"}</option>)}</select></label>{selectedExtrusion?.source?<p className="material-detail">{selectedExtrusion.source.width} × {selectedExtrusion.source.height} mm · {selectedExtrusion.source.weight} kg/m</p>:<p className="material-detail">Connect to the Pricing Engine to load the configured extrusion list.</p>}</Section>
        <Section title="Next segment"><p className="instruction">{!startPlaced?"Click any grid point to place the start.":stats.closed?"Frame closed. Select either end to extend it.":`Adding at the ${selectedEnd==="start"?"start":"end"}. Choose a direction and length.`}</p><div className="directions">{([["N","↑","Up"],["W","←","Left"],["E","→","Right"],["S","↓","Down"]] as [Heading,string,string][]).map(([value,arrow,label])=><button key={value} className={`dir-${value.toLowerCase()} ${direction===value?"chosen":""}`} onClick={()=>setDirection(value)} disabled={!startPlaced}><b>{arrow}</b>{label}</button>)}</div><label className="next-length">Length<input type="number" min="1" step={snap?50:1} value={nextLength} onChange={e=>setNextLength(Number(e.target.value))} onKeyDown={e=>{if(e.key==="Enter")addSegment()}}/><span>mm</span></label><button className="add-segment" onClick={addSegment} disabled={!startPlaced||!direction||nextLength<=0}>Add segment at {selectedEnd==="start"?"start":"end"}</button><button className="undo" onClick={undo}>↶ Undo last segment <kbd>⌘Z</kbd></button></Section>
      </aside>
      <section className="stage">
        <div className="stage-head"><div><h2>Build Preview</h2><span className={stats.closed?"success":"open-status"}>{stats.closed?"✓ Closed frame":startPlaced?"Open frame":"Place start point"}</span></div><div className="tools"><button onClick={()=>setZoom(z=>Math.min(2,z+.1))}>＋</button><button onClick={()=>setZoom(z=>Math.max(.25,z-.1))}>−</button><button onClick={fitFrame}>Fit frame</button><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/><i/>Snap 50 mm</label></div></div>
        <div className={`canvas ${snap?"grid":""}`}>
          <svg viewBox="0 0 620 420" className={!design.segments.length?"placing":""} onClick={placeStart} role={design.segments.length?"img":"button"} tabIndex={!design.segments.length?0:undefined} aria-label={startPlaced?(design.segments.length?`Frame ${stats.width} by ${stats.height} millimetres`:"Starting point placed; click elsewhere to move it or choose a direction"):"Click a grid point to place the starting point"}>
            {startPlaced&&<>
            <defs>{design.segments.map((s,i)=><clipPath key={s.id} id={`segment-clip-${s.id}`} clipPathUnits="userSpaceOnUse"><polygon points={segmentClipPolygon(i)}/></clipPath>)}</defs>
            {design.segments.map((s,i)=>{const a=xy(points[i]),b=xy(points[i+1]),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,len=Math.hypot(b.x-a.x,b.y-a.y)||1,ox=-(b.y-a.y)/len,oy=(b.x-a.x)/len;return <g key={s.id} className={selected===s.id?"selected":""} onClick={()=>selectSegment(s.id)}><line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><g clipPath={`url(#segment-clip-${s.id})`}><line className="rail" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="face" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><line className="profile-highlight" x1={a.x+ox*5} y1={a.y+oy*5} x2={b.x+ox*5} y2={b.y+oy*5}/><line className="profile-groove" x1={a.x-ox*3} y1={a.y-oy*3} x2={b.x-ox*3} y2={b.y-oy*3}/></g>{editingDimension===s.id?<foreignObject x={mx-48} y={my-18} width="96" height="36" onClick={e=>e.stopPropagation()}><input className="dimension-edit" autoFocus inputMode="numeric" value={dimensionDraft} onChange={e=>setDimensionDraft(e.target.value)} onBlur={commitDimensionEdit} onKeyDown={e=>{if(e.key==="Enter")commitDimensionEdit();if(e.key==="Escape")setEditingDimension(null)}} aria-label={`Edit segment ${i+1} length in millimetres`}/></foreignObject>:<g className="dimension-label" transform={`translate(${mx} ${my})`} onClick={e=>{e.stopPropagation();beginDimensionEdit(s.id,s.length)}} role="button" tabIndex={0} aria-label={`Edit ${s.length} millimetre dimension`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();beginDimensionEdit(s.id,s.length)}}}><rect x="-38" y="-13" width="76" height="26" rx="4"/><text dy="4" textAnchor="middle">{s.length} mm</text></g>}</g>})}
            {design.segments.slice(1).map((_,i)=>{const index=i+1;return <CornerHardware key={`corner-${index}`} point={xy(points[index])} before={xy(points[index-1])} after={xy(points[index+1])}/>})}
            {stats.closed&&<CornerHardware point={xy(points[0])} before={xy(points.at(-2)!)} after={xy(points[1])}/>}
            {points.map((p,i)=>{const q=xy(p),isStart=i===0,isEnd=i===points.length-1&&points.length>1;if(isStart||isEnd){const endType:"start"|"end"=isEnd||points.length===1?"end":"start";return <g key={i} className={`selectable-point ${selectedEnd===endType?"point-selected":""}`} onClick={e=>{e.stopPropagation();selectEnd(endType)}} role="button" tabIndex={0} aria-label={`Select ${points.length===1?"starting":endType} point`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectEnd(endType)}}}><circle className="point-hit" cx={q.x} cy={q.y} r="16"/><circle cx={q.x} cy={q.y} r="8" className={isStart?"start":"current"}/></g>}return <circle key={i} cx={q.x} cy={q.y} r="4" className="joint"/>})}
            </>}
          </svg>
          {!startPlaced&&<div className="place">＋ Click any grid intersection to place the starting point</div>}
          {startPlaced&&!design.segments.length&&<div className="reposition-hint">Click another grid point to reposition the start</div>}
          <div className="legend"><span><i className="start-dot"/>Unselected end</span><span><i className="current-dot"/>Selected end</span><span className="profile-key">{profileLabel}</span></div>
        </div>
        <div className="stage-foot"><span className={selectionNotice?"selection-error":""}>{selectionNotice||(selectedEnd?`${selectedEnd==="start"?"Start":"End"} point selected · New segments extend here; Delete removes the adjacent segment.`:selected?"Segment selected · Delete is available only at the beginning or end of the sequence.":"Orthogonal drawing · dimensions in millimetres")}</span><b>{Math.round(zoom*100)}%</b></div>
        <section className="history"><button onClick={()=>setHistoryOpen(v=>!v)}><span><b>Construction history</b><small>Generated from the frame</small></span>{historyOpen?"⌄":"⌃"}</button>{historyOpen&&<div>{historyFor(design).map((line,i)=><code key={i}><em>{String(i+1).padStart(2,"0")}</em>{line}</code>)}</div>}</section>
      </section>
      <aside className="results">
        <div className="tabs" role="tablist">{(["summary","cuts","bom"] as Tab[]).map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t==="summary"?"Summary":t==="cuts"?"Cut list":"BOM"}</button>)}</div>
        {tab==="summary"&&<Summary stats={stats} count={design.segments.length} pricing={pricing} pricingError={pricingError} quote={quote} connected={!!pricingConfig} username={pricingUser} onConnect={connectPricing} onDisconnect={disconnectPricing} onRecalculate={recalculate}/>}
        {tab==="cuts"&&<CutList design={design} selected={selected} profileLabel={profileLabel} changeLength={changeLength}/>}
        {tab==="bom"&&<Bom takeoff={takeoff} profileLabel={profileLabel}/>}
      </aside>
    </main>
  </div>;
}

type CanvasPoint = {x:number;y:number};
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
function Summary({stats,count,pricing,pricingError,quote,connected,username,onConnect,onDisconnect,onRecalculate}:{stats:ReturnType<typeof summary>;count:number;pricing:PricingState;pricingError:string;quote:FramePricingQuote|null;connected:boolean;username:string;onConnect:()=>void;onDisconnect:()=>void;onRecalculate:()=>void}){
  const status = pricing === "connecting" ? ["Connecting to Pricing Engine", "Validating your secure session."] : pricing === "error" ? ["Pricing context is not connected", pricingError||"Connect again to continue."] : connected ? ["Pricing Engine connected", stats.closed ? `Connected as ${username}. Current pricing is ready.` : `Connected as ${username}. Complete the frame to calculate current pricing.`] : ["Pricing context is not connected", "Connect with the same account you use for SAV Builder."];
  return <>
    <div className={stats.closed?"complete":"frame-progress"}><span>{stats.closed?"✓":"＋"}</span><div><b>{stats.closed?"Frame is complete":count?"Frame is open":"Ready to draw"}</b><small>{stats.closed?"All segments form a closed path.":count?"Add segments until the current point returns to the start.":"Place a start point, choose a direction and enter a length."}</small></div></div>
    <Section title="Frame summary"><dl>{[["Overall width",`${stats.width.toLocaleString()} mm`],["Overall height",`${stats.height.toLocaleString()} mm`],["Total perimeter",`${stats.perimeter.toLocaleString()} mm`],["Extrusion pieces",count],["90° corners",stats.corners],["45° mitre cuts",stats.mitres]].map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl></Section>
    <Section title="Stock estimate"><div className="stock"><b>{stats.stock}</b><span><strong>× 5,600 mm lengths</strong><small>Estimated stock requirement</small></span></div><div className="waste"><span>Estimated material waste</span><b>{stats.waste.toLocaleString()} mm</b><i><em style={{width:stats.stock?`${Math.max(3,stats.waste/(stats.stock*5600)*100)}%`:"0%"}}/></i></div></Section>
    <Section title="Pricing">
      {quote && typeof quote.total === "number" ? <div className="quoted"><small>Calculated total</small><strong>{formatMoney(quote.total, quote.currency)}</strong></div> : <div className={`pricing-state ${pricing === "error" ? "pricing-error" : ""}`}><b>{pricing === "connecting" ? "…" : pricing === "error" ? "!" : "i"}</b><span><strong>{status[0]}</strong><small>{status[1]}</small></span></div>}
      {!connected?<button className="primary" onClick={onConnect} disabled={pricing==="connecting"}>{pricing==="connecting"?"Connecting…":"Connect pricing"}</button>:<><button className="primary" onClick={onRecalculate} disabled={!stats.closed||pricing==="loading"}>{pricing === "loading" ? "Calculating…" : "Recalculate price"}</button><button className="disconnect" onClick={onDisconnect}>Disconnect {username}</button></>}
      {quote?.calculatedAt&&<p className="last">Last calculated {new Date(quote.calculatedAt).toLocaleString("en-AU")}</p>}
    </Section>
  </>;
}
function CutList({design,selected,profileLabel,changeLength}:{design:Design;selected:string;profileLabel:string;changeLength:(id:string,n:number)=>void}){let n=0;return <div className="data"><h3>Manufacturable pieces</h3><p>Finished outside / long-point measurements.</p>{design.segments.flatMap(s=>splitForStock(s.length).map((length,j,a)=>({s,length,j,a}))).map(({s,length,j,a})=><article key={`${s.id}-${j}`} className={selected===s.id?"row-selected":""}><span>{++n}</span><div><b>{profileLabel}</b><small>{j===0?"45°":"90°"} / {j===a.length-1?"45°":"90°"} end cuts</small></div><label><input type="number" value={length} onChange={e=>changeLength(s.id,Number(e.target.value))}/><i>mm</i></label></article>)}</div>}
function Bom({takeoff,profileLabel}:{takeoff:ReturnType<typeof prepareFrameTakeoff>;profileLabel:string}){return <div className="data"><h3>Bill of materials</h3><p>Calculated directly from the current frame geometry.</p><article><span>{takeoff.cutPieces.length}</span><div><b>{profileLabel}</b><small>{takeoff.profileId}</small></div><em className="bom-status">Required</em></article>{takeoff.accessories.map(a=><article key={a.mappingKey}><span>{a.quantity}</span><div><b>{a.mappingKey.replaceAll("_"," ")}</b><small>Frame hardware</small></div><em className="bom-status">Required</em></article>)}</div>}
