export type Heading = "N" | "E" | "S" | "W";
export type Turn = "left" | "straight" | "right" | "back";
export type Point = { x: number; y: number };
export type Segment = { id: string; heading: Heading; length: number; turn: Turn };
export type Design = { start: Point; initialHeading: Heading | null; segments: Segment[] };
export type BraceConfig = { horizontalSpacing: number | null; verticalSpacing: number | null; braceOffset: number; hBraceWidth: number; miniBraceWidth: number };
export type BracePiece = { id: string; kind: "h-brace" | "mini-brace"; orientation: "horizontal" | "vertical"; start: Point; end: Point; lengthMm: number; widthMm: number; tensionLocks: number };

const headings: Heading[] = ["N", "E", "S", "W"];
export function turnHeading(heading: Heading, turn: Turn): Heading {
  const delta = turn === "left" ? -1 : turn === "right" ? 1 : turn === "back" ? 2 : 0;
  return headings[(headings.indexOf(heading) + delta + 4) % 4];
}
export function endpoint(point: Point, heading: Heading, length: number): Point {
  const vector: Record<Heading, Point> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
  return { x: point.x + vector[heading].x * length, y: point.y + vector[heading].y * length };
}
export function pointsFor(design: Design): Point[] {
  const points = [design.start];
  design.segments.forEach((segment) => points.push(endpoint(points.at(-1)!, segment.heading, segment.length)));
  return points;
}
function relativeTurn(from: Heading, to: Heading): Turn {
  const delta = (headings.indexOf(to) - headings.indexOf(from) + 4) % 4;
  return delta === 0 ? "straight" : delta === 1 ? "right" : delta === 2 ? "back" : "left";
}
export function addBoundarySegment(design: Design, boundary: "start" | "end", outwardHeading: Heading, length: number, id: string): Design {
  const roundedLength = Math.max(1, Math.round(length));
  if (boundary === "start" && design.segments.length) {
    const heading = turnHeading(outwardHeading, "back");
    const first = design.segments[0];
    return {
      ...design,
      start: endpoint(design.start, outwardHeading, roundedLength),
      initialHeading: heading,
      segments: [
        { id, heading, length: roundedLength, turn: "straight" },
        { ...first, turn: relativeTurn(heading, first.heading) },
        ...design.segments.slice(1),
      ],
    };
  }
  const last = design.segments.at(-1);
  return {
    ...design,
    initialHeading: design.initialHeading ?? outwardHeading,
    segments: [...design.segments, { id, heading: outwardHeading, length: roundedLength, turn: last ? relativeTurn(last.heading, outwardHeading) : "straight" }],
  };
}
export function removeBoundarySegment(design: Design, boundary: "start" | "end"): Design {
  if (!design.segments.length) return design;
  if (boundary === "end") {
    const segments = design.segments.slice(0, -1);
    return { ...design, initialHeading: segments[0]?.heading ?? null, segments };
  }
  const first = design.segments[0];
  const segments = design.segments.slice(1).map((segment, index) => index === 0 ? { ...segment, turn: "straight" as Turn } : segment);
  return {
    ...design,
    start: endpoint(design.start, first.heading, first.length),
    initialHeading: segments[0]?.heading ?? null,
    segments,
  };
}
export function isClosed(design: Design): boolean {
  const p = pointsFor(design);
  return design.segments.length > 2 && p[0].x === p.at(-1)!.x && p[0].y === p.at(-1)!.y;
}
export function bounds(design: Design) {
  const p = pointsFor(design), xs = p.map(v => v.x), ys = p.map(v => v.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
export function summary(design: Design) {
  const perimeter = design.segments.reduce((n, s) => n + s.length, 0);
  const stock = Math.ceil(perimeter / 5600), closed = isClosed(design);
  const corners = closed ? design.segments.length : Math.max(0, design.segments.length - 1);
  return { ...bounds(design), perimeter, stock, waste: stock * 5600 - perimeter, corners, mitres: corners * 2, closed };
}
export function summaryForDesigns(designs: Design[]) {
  const nonEmpty = designs.filter(design => design.segments.length);
  const allPoints = designs.flatMap(pointsFor);
  const xs = allPoints.map(point => point.x), ys = allPoints.map(point => point.y);
  const perimeter = designs.reduce((total, design) => total + design.segments.reduce((sum, segment) => sum + segment.length, 0), 0);
  const stock = Math.ceil(perimeter / 5600);
  const summaries = designs.map(summary);
  const corners = summaries.reduce((total, item) => total + item.corners, 0);
  return {
    width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    height: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
    perimeter,
    stock,
    waste: stock * 5600 - perimeter,
    corners,
    mitres: corners * 2,
    closed: nonEmpty.length > 0 && nonEmpty.every(isClosed),
  };
}
export function historyFor(design: Design): string[] {
  const names: Record<Heading, string> = { N: "NORTH", E: "EAST", S: "SOUTH", W: "WEST" };
  const result = [design.initialHeading ? `START ${names[design.initialHeading]}` : "START"];
  design.segments.forEach((s, index) => { result.push(`FORWARD ${s.length}`); if (design.segments[index + 1]) result.push(design.segments[index + 1].turn.toUpperCase()); });
  if (isClosed(design)) result.push("CLOSE");
  return result;
}
export function splitForStock(length: number, stock = 5600): number[] {
  const result: number[] = []; let remaining = length;
  while (remaining > stock) { result.push(stock); remaining -= stock; }
  if (remaining) result.push(remaining);
  return result;
}
function spacedPositions(min:number,max:number,spacing:number|null){
  const length=max-min;
  if(spacing==null||!Number.isFinite(spacing)||spacing<=0||length<=0)return [];
  const count=Math.max(0,Math.ceil(length/spacing)-1);
  return Array.from({length:count},(_,index)=>min+length*(index+1)/(count+1));
}
function internalCornerPositions(design:Design,orientation:"horizontal"|"vertical"){
  const ring=pointsFor(design).slice(0,-1);
  const area2=ring.reduce((sum,point,index)=>{const next=ring[(index+1)%ring.length];return sum+point.x*next.y-next.x*point.y},0);
  if(!area2)return [];
  return ring.flatMap((point,index)=>{
    const previous=ring[(index-1+ring.length)%ring.length],next=ring[(index+1)%ring.length];
    const cross=(point.x-previous.x)*(next.y-point.y)-(point.y-previous.y)*(next.x-point.x);
    return cross*area2<0?[orientation==="horizontal"?point.x:point.y]:[];
  });
}
function ringFor(design:Design){return pointsFor(design).slice(0,-1)}
function pointOnSegment(point:Point,a:Point,b:Point){
  const cross=(point.x-a.x)*(b.y-a.y)-(point.y-a.y)*(b.x-a.x);
  return Math.abs(cross)<1e-7&&point.x>=Math.min(a.x,b.x)&&point.x<=Math.max(a.x,b.x)&&point.y>=Math.min(a.y,b.y)&&point.y<=Math.max(a.y,b.y);
}
function pointInPolygon(point:Point,design:Design){
  const ring=ringFor(design);
  if(ring.some((a,index)=>pointOnSegment(point,a,ring[(index+1)%ring.length])))return false;
  let inside=false;
  for(let index=0,j=ring.length-1;index<ring.length;j=index++){
    const a=ring[index],b=ring[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function seriesNestingDepths(designs:Design[]){
  return designs.map((candidate,candidateIndex)=>isClosed(candidate)?designs.reduce((depth,container,containerIndex)=>{
    if(containerIndex===candidateIndex||!isClosed(container))return depth;
    const candidateRing=ringFor(candidate);
    return candidateRing.length&&candidateRing.every(point=>pointInPolygon(point,container))?depth+1:depth;
  },0):0);
}
export function profileFacingSides(designs:Design[]){
  const depths=seriesNestingDepths(designs);
  return designs.map((design,index)=>{
    const ring=ringFor(design),area2=ring.reduce((sum,point,pointIndex)=>{const next=ring[(pointIndex+1)%ring.length];return sum+point.x*next.y-next.x*point.y},0);
    return (area2<0?-1:1)*(depths[index]%2?-1:1);
  });
}
function requiredInteriorCount(boundaries:number[],spacing:number){
  return boundaries.slice(0,-1).reduce((count,start,index)=>count+Math.max(0,Math.ceil((boundaries[index+1]-start)/spacing)-1),0);
}
function preferredGapPositions(min:number,max:number,spacing:number,preferred:number[]){
  const budget=Math.max(0,Math.ceil((max-min)/spacing)-1);
  if(!budget)return [];
  const candidates=[...new Set(preferred.filter(value=>value>min&&value<max))].sort((a,b)=>a-b).slice(0,16);
  let chosen:number[]=[];
  for(let mask=1;mask<(1<<candidates.length);mask++){
    const selection=candidates.filter((_,index)=>mask&(1<<index));
    if(selection.length<=chosen.length||selection.length>budget)continue;
    const boundaries=[min,...selection,max];
    if(selection.length+requiredInteriorCount(boundaries,spacing)<=budget)chosen=selection;
  }
  const boundaries=[min,...chosen,max];
  return [...chosen,...boundaries.slice(0,-1).flatMap((start,index)=>spacedPositions(start,boundaries[index+1],spacing))];
}
function segmentSpacingPositions(design:Design,orientation:"horizontal"|"vertical",spacing:number|null){
  if(spacing==null||!Number.isFinite(spacing)||spacing<=0)return [];
  const points=pointsFor(design),preferred=internalCornerPositions(design,orientation),positions:number[]=[];
  const intervals=design.segments.flatMap((segment,index)=>{
    const horizontal=segment.heading==="E"||segment.heading==="W";
    if((orientation==="horizontal")!==horizontal)return [];
    const a=points[index],b=points[index+1],start=orientation==="horizontal"?a.x:a.y,end=orientation==="horizontal"?b.x:b.y;
    return [{min:Math.min(start,end),max:Math.max(start,end)}];
  }).sort((a,b)=>(b.max-b.min)-(a.max-a.min));
  intervals.forEach(({min,max})=>{
    const existing=positions.filter(value=>value>min&&value<max).sort((a,b)=>a-b),boundaries=[min,...existing,max];
    boundaries.slice(0,-1).forEach((start,index)=>positions.push(...preferredGapPositions(start,boundaries[index+1],spacing,preferred)));
  });
  return [...new Set(positions.map(value=>Math.round(value*1e6)/1e6))].sort((a,b)=>a-b);
}
function assemblySpacingPositions(designs:Design[],orientation:"horizontal"|"vertical",spacing:number|null,depths:number[]){
  if(spacing==null||!Number.isFinite(spacing)||spacing<=0)return [];
  const preferred=designs.flatMap((design,index)=>depths[index]>0?ringFor(design).map(point=>orientation==="horizontal"?point.x:point.y):[]);
  const positions:number[]=[];
  const intervals=designs.flatMap(design=>{
    const points=pointsFor(design);
    return design.segments.flatMap((segment,index)=>{
      const horizontal=segment.heading==="E"||segment.heading==="W";
      if((orientation==="horizontal")!==horizontal)return [];
      const a=points[index],b=points[index+1],start=orientation==="horizontal"?a.x:a.y,end=orientation==="horizontal"?b.x:b.y;
      return [{min:Math.min(start,end),max:Math.max(start,end)}];
    });
  }).sort((a,b)=>(b.max-b.min)-(a.max-a.min));
  intervals.forEach(({min,max})=>{
    const existing=positions.filter(value=>value>min&&value<max).sort((a,b)=>a-b),boundaries=[min,...existing,max];
    boundaries.slice(0,-1).forEach((start,index)=>positions.push(...preferredGapPositions(start,boundaries[index+1],spacing,preferred)));
  });
  return [...new Set(positions.map(value=>Math.round(value*1e6)/1e6))].sort((a,b)=>a-b);
}
function paired(values:number[]){
  const sorted=[...new Set(values)].sort((a,b)=>a-b),result:Array<[number,number]>=[];
  for(let index=0;index+1<sorted.length;index+=2)if(sorted[index+1]>sorted[index])result.push([sorted[index],sorted[index+1]]);
  return result;
}
function shorten(start:Point,end:Point,deduction:number){
  const length=Math.hypot(end.x-start.x,end.y-start.y),trim=Math.min(Math.max(0,deduction),Math.max(0,length-1))/2;
  if(!length)return {start,end,lengthMm:0};
  const ux=(end.x-start.x)/length,uy=(end.y-start.y)/length;
  return {start:{x:start.x+ux*trim,y:start.y+uy*trim},end:{x:end.x-ux*trim,y:end.y-uy*trim},lengthMm:Math.max(1,Math.round(length-trim*2))};
}
export function crossBracePieces(design:Design,config:BraceConfig):BracePiece[]{
  if(!isClosed(design))return [];
  const polygon=pointsFor(design),xs=polygon.map(point=>point.x),ys=polygon.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const verticalRaw=segmentSpacingPositions(design,"horizontal",config.horizontalSpacing).filter(x=>x>minX&&x<maxX).flatMap((x,xIndex)=>{
    const intersections:number[]=[];
    design.segments.forEach((segment,index)=>{const a=polygon[index],b=polygon[index+1];if(a.y===b.y&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x))intersections.push(a.y)});
    return paired(intersections).map(([y1,y2],spanIndex)=>({x,y1,y2,xIndex,spanIndex}));
  });
  const horizontalRaw=segmentSpacingPositions(design,"vertical",config.verticalSpacing).filter(y=>y>minY&&y<maxY).flatMap((y,yIndex)=>{
    const intersections:number[]=[];
    design.segments.forEach((segment,index)=>{const a=polygon[index],b=polygon[index+1];if(a.x===b.x&&y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y))intersections.push(a.x)});
    return paired(intersections).map(([x1,x2],spanIndex)=>({y,x1,x2,yIndex,spanIndex}));
  });
  const pieces:BracePiece[]=[];
  verticalRaw.forEach(raw=>{const hasSideBrace=horizontalRaw.some(horizontal=>raw.x>horizontal.x1&&raw.x<horizontal.x2&&horizontal.y>raw.y1&&horizontal.y<raw.y2),kind=hasSideBrace?"h-brace":"mini-brace",cut=shorten({x:raw.x,y:raw.y1},{x:raw.x,y:raw.y2},config.braceOffset);pieces.push({id:`v-${raw.xIndex}-${raw.spanIndex}`,kind,orientation:"vertical",...cut,widthMm:hasSideBrace?config.hBraceWidth:config.miniBraceWidth,tensionLocks:2})});
  horizontalRaw.forEach(raw=>{
    const crossings=verticalRaw.filter(vertical=>vertical.x>raw.x1&&vertical.x<raw.x2&&raw.y>vertical.y1&&raw.y<vertical.y2).map(vertical=>vertical.x).sort((a,b)=>a-b);
    if(!crossings.length){const cut=shorten({x:raw.x1,y:raw.y},{x:raw.x2,y:raw.y},config.braceOffset);pieces.push({id:`h-${raw.yIndex}-${raw.spanIndex}`,kind:"mini-brace",orientation:"horizontal",...cut,widthMm:config.miniBraceWidth,tensionLocks:2});return}
    const boundaries=[raw.x1,...crossings,raw.x2],lastPieceIndex=boundaries.length-2;
    [0,lastPieceIndex].filter((pieceIndex,index,all)=>all.indexOf(pieceIndex)===index).forEach(pieceIndex=>{
      const x1=boundaries[pieceIndex],x2=boundaries[pieceIndex+1],lengthMm=Math.max(1,Math.round(x2-x1-25));
      const start={x:x1+(pieceIndex===lastPieceIndex?config.hBraceWidth/2:0),y:raw.y},end={x:x2-(pieceIndex===0?config.hBraceWidth/2:0),y:raw.y};
      pieces.push({id:`m-${raw.yIndex}-${raw.spanIndex}-${pieceIndex}`,kind:"mini-brace",orientation:"horizontal",start,end,lengthMm,widthMm:config.miniBraceWidth,tensionLocks:2});
    });
  });
  return pieces;
}
export function crossBracePiecesForDesigns(designs:Design[],config:BraceConfig):BracePiece[]{
  const closed=designs.filter(isClosed),depths=seriesNestingDepths(closed);
  if(!closed.length)return [];
  if(!depths.some(depth=>depth>0))return closed.flatMap((design,index)=>crossBracePieces(design,config).map(piece=>({...piece,id:`s${index}-${piece.id}`})));
  const polygons=closed.map(pointsFor),allPoints=polygons.flat(),xs=allPoints.map(point=>point.x),ys=allPoints.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const verticalRaw=assemblySpacingPositions(closed,"horizontal",config.horizontalSpacing,depths).filter(x=>x>minX&&x<maxX).flatMap((x,xIndex)=>{
    const intersections:number[]=[];
    closed.forEach((design,designIndex)=>design.segments.forEach((segment,index)=>{const a=polygons[designIndex][index],b=polygons[designIndex][index+1];if(a.y===b.y&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x))intersections.push(a.y)}));
    return paired(intersections).map(([y1,y2],spanIndex)=>({x,y1,y2,xIndex,spanIndex}));
  });
  const horizontalRaw=assemblySpacingPositions(closed,"vertical",config.verticalSpacing,depths).filter(y=>y>minY&&y<maxY).flatMap((y,yIndex)=>{
    const intersections:number[]=[];
    closed.forEach((design,designIndex)=>design.segments.forEach((segment,index)=>{const a=polygons[designIndex][index],b=polygons[designIndex][index+1];if(a.x===b.x&&y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y))intersections.push(a.x)}));
    return paired(intersections).map(([x1,x2],spanIndex)=>({y,x1,x2,yIndex,spanIndex}));
  });
  const pieces:BracePiece[]=[];
  verticalRaw.forEach(raw=>{const hasSideBrace=horizontalRaw.some(horizontal=>raw.x>horizontal.x1&&raw.x<horizontal.x2&&horizontal.y>raw.y1&&horizontal.y<raw.y2),kind=hasSideBrace?"h-brace":"mini-brace",cut=shorten({x:raw.x,y:raw.y1},{x:raw.x,y:raw.y2},config.braceOffset);pieces.push({id:`av-${raw.xIndex}-${raw.spanIndex}`,kind,orientation:"vertical",...cut,widthMm:hasSideBrace?config.hBraceWidth:config.miniBraceWidth,tensionLocks:2})});
  horizontalRaw.forEach(raw=>{
    const crossings=verticalRaw.filter(vertical=>vertical.x>raw.x1&&vertical.x<raw.x2&&raw.y>vertical.y1&&raw.y<vertical.y2).map(vertical=>vertical.x).sort((a,b)=>a-b);
    if(!crossings.length){const cut=shorten({x:raw.x1,y:raw.y},{x:raw.x2,y:raw.y},config.braceOffset);pieces.push({id:`ah-${raw.yIndex}-${raw.spanIndex}`,kind:"mini-brace",orientation:"horizontal",...cut,widthMm:config.miniBraceWidth,tensionLocks:2});return}
    const boundaries=[raw.x1,...crossings,raw.x2],lastPieceIndex=boundaries.length-2;
    [0,lastPieceIndex].filter((pieceIndex,index,all)=>all.indexOf(pieceIndex)===index).forEach(pieceIndex=>{
      const x1=boundaries[pieceIndex],x2=boundaries[pieceIndex+1],lengthMm=Math.max(1,Math.round(x2-x1-25));
      const start={x:x1+(pieceIndex===lastPieceIndex?config.hBraceWidth/2:0),y:raw.y},end={x:x2-(pieceIndex===0?config.hBraceWidth/2:0),y:raw.y};
      pieces.push({id:`am-${raw.yIndex}-${raw.spanIndex}-${pieceIndex}`,kind:"mini-brace",orientation:"horizontal",start,end,lengthMm,widthMm:config.miniBraceWidth,tensionLocks:2});
    });
  });
  return pieces;
}
export type GeometryIssue = { type: "zero-length" | "overlap" | "intersection"; segmentIds: string[] };
function between(n:number,a:number,b:number){ return n>=Math.min(a,b)&&n<=Math.max(a,b); }
export function geometryIssues(design: Design): GeometryIssue[] {
  const p=pointsFor(design), issues:GeometryIssue[]=[];
  design.segments.forEach(s=>{if(s.length<=0)issues.push({type:"zero-length",segmentIds:[s.id]})});
  for(let i=0;i<design.segments.length;i++) for(let j=i+1;j<design.segments.length;j++){
    if(j===i+1 || (i===0&&j===design.segments.length-1&&isClosed(design))) continue;
    const a=p[i],b=p[i+1],c=p[j],d=p[j+1], ah=a.y===b.y, ch=c.y===d.y;
    if(ah===ch){
      const same=ah?a.y===c.y:a.x===c.x;
      const overlap=same&&(ah?Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)):Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)));
      if(overlap)issues.push({type:"overlap",segmentIds:[design.segments[i].id,design.segments[j].id]});
    }else{
      const h=ah?{a,b}:{a:c,b:d},v=ah?{a:c,b:d}:{a,b};
      if(between(v.a.x,h.a.x,h.b.x)&&between(h.a.y,v.a.y,v.b.y))issues.push({type:"intersection",segmentIds:[design.segments[i].id,design.segments[j].id]});
    }
  }
  return issues;
}
export function rectangle(width = 2400, height = 1800): Design {
  return { start: { x: 0, y: 0 }, initialHeading: "E", segments: [
    { id: "s1", heading: "E", length: width, turn: "straight" },
    { id: "s2", heading: "S", length: height, turn: "right" },
    { id: "s3", heading: "W", length: width, turn: "right" },
    { id: "s4", heading: "N", length: height, turn: "right" },
  ] };
}

export type FrameTakeoff = { profileId: string; finishId: string; quantity: number; cutPieces: { lengthMm: number; leftCut: "45" | "90"; rightCut: "45" | "90" }[]; bracePieces: { kind:"h-brace"|"mini-brace"; orientation:"horizontal"|"vertical"; lengthMm:number }[]; accessories: { mappingKey: string; quantity: number }[] };
export function prepareFrameTakeoff(design: Design, profileId: string, finishId: string, quantity = 1): FrameTakeoff {
  const cutPieces = design.segments.flatMap(s => splitForStock(s.length).map((lengthMm, i, all) => ({ lengthMm, leftCut: (i === 0 ? "45" : "90") as "45"|"90", rightCut: (i === all.length - 1 ? "45" : "90") as "45"|"90" })));
  const joins = cutPieces.length - design.segments.length;
  return { profileId, finishId, quantity, cutPieces, bracePieces:[], accessories: [{ mappingKey: "corner_component", quantity: summary(design).corners }, ...(joins ? [{ mappingKey: "straight_joiner", quantity: joins }] : [])] };
}
export function prepareFrameTakeoffForDesigns(designs: Design[], profileId: string, finishId: string, quantity = 1, braceConfig?:BraceConfig): FrameTakeoff {
  const takeoffs = designs.filter(design => design.segments.length).map(design => prepareFrameTakeoff(design, profileId, finishId));
  const accessoryQuantities = new Map<string,number>();
  takeoffs.flatMap(takeoff => takeoff.accessories).forEach(accessory => accessoryQuantities.set(accessory.mappingKey,(accessoryQuantities.get(accessory.mappingKey)??0)+accessory.quantity));
  return {
    profileId,
    finishId,
    quantity,
    cutPieces: takeoffs.flatMap(takeoff => takeoff.cutPieces),
    bracePieces: braceConfig?crossBracePiecesForDesigns(designs,braceConfig).map(piece=>({kind:piece.kind,orientation:piece.orientation,lengthMm:piece.lengthMm})):[],
    accessories: [...accessoryQuantities].map(([mappingKey,accessoryQuantity]) => ({mappingKey,quantity:accessoryQuantity})),
  };
}
