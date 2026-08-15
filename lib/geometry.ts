export type Heading = "N" | "E" | "S" | "W";
export type Turn = "left" | "straight" | "right" | "back";
export type Point = { x: number; y: number };
export type Segment = { id: string; heading: Heading; length: number; turn: Turn };
export type Design = { start: Point; initialHeading: Heading | null; segments: Segment[] };

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

export type PricingTakeoff = { profileId: string; finishId: string; quantity: number; cutPieces: { lengthMm: number; leftCut: "45" | "90"; rightCut: "45" | "90" }[]; accessories: { mappingKey: string; quantity: number }[] };
export function preparePricingTakeoff(design: Design, profileId: string, finishId: string, quantity = 1): PricingTakeoff {
  const cutPieces = design.segments.flatMap(s => splitForStock(s.length).map((lengthMm, i, all) => ({ lengthMm, leftCut: (i === 0 ? "45" : "90") as "45"|"90", rightCut: (i === all.length - 1 ? "45" : "90") as "45"|"90" })));
  const joins = cutPieces.length - design.segments.length;
  return { profileId, finishId, quantity, cutPieces, accessories: [{ mappingKey: "corner_component", quantity: summary(design).corners }, ...(joins ? [{ mappingKey: "straight_joiner", quantity: joins }] : [])] };
}
