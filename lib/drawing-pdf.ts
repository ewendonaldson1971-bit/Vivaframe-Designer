import { pointsFor, profileFacingSides, summaryForDesigns, type BracePiece, type Design, type Point } from "./geometry.ts";

export type DrawingPdfOptions={designs:Design[];braces:BracePiece[];title:string;profileLabel:string;profileHeightMm:number;quantity:number;generatedAt?:Date};

const page={width:1190.55,height:841.89}; // ISO A3 landscape in PostScript points.
const ptPerMm=72/25.4;
const clean=(value:number)=>Number(value.toFixed(2));
const ascii=(value:string)=>value.normalize("NFKD").replace(/[^\x20-\x7e]/g,"-");
const escapePdf=(value:string)=>ascii(value).replace(/([\\()])/g,"\\$1");

function makePdf(content:string){
  const encoder=new TextEncoder(),objects=[
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ],parts=["%PDF-1.4\n%VivaFrame\n"],offsets=[0];
  objects.forEach((object,index)=>{offsets.push(encoder.encode(parts.join("")).length);parts.push(`${index+1} 0 obj\n${object}\nendobj\n`)});
  const xref=encoder.encode(parts.join("")).length;
  parts.push(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,"0")+" 00000 n ").join("\n")}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return encoder.encode(parts.join(""));
}

export function createFrameDrawingPdf(options:DrawingPdfOptions){
  const {designs,braces,title,profileLabel,profileHeightMm,quantity}=options,allPoints=designs.flatMap(pointsFor),stats=summaryForDesigns(designs);
  if(!allPoints.length)throw new Error("The drawing has no frame geometry.");
  const xs=allPoints.map(point=>point.x),ys=allPoints.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),modelWidth=Math.max(1,maxX-minX),modelHeight=Math.max(1,maxY-minY),drawingBox={left:92,bottom:154},availableWidth=1058,availableHeight=636;
  const scale=([5,10,20,25,50,100,200,250,500] as number[]).find(candidate=>modelWidth*ptPerMm/candidate<=availableWidth&&modelHeight*ptPerMm/candidate<=availableHeight)??500,factor=ptPerMm/scale,drawWidth=modelWidth*factor,drawHeight=modelHeight*factor,originX=drawingBox.left+(availableWidth-drawWidth)/2,originY=drawingBox.bottom+(availableHeight-drawHeight)/2;
  const map=(point:Point)=>({x:originX+(point.x-minX)*factor,y:originY+(maxY-point.y)*factor}),commands:string[]=[];
  const line=(a:Point,b:Point,width=1,grey=0)=>commands.push(`${grey} G ${clean(width)} w ${clean(a.x)} ${clean(a.y)} m ${clean(b.x)} ${clean(b.y)} l S`);
  const rect=(x:number,y:number,width:number,height:number,lineWidth=1)=>commands.push(`0 G ${lineWidth} w ${clean(x)} ${clean(y)} ${clean(width)} ${clean(height)} re S`);
  const text=(x:number,y:number,value:string,size=9,bold=false,centre=false,angle=0)=>{const safe=escapePdf(value),estimated=safe.length*size*.52,tx=centre?x-estimated/2:x,cos=clean(Math.cos(angle)),sin=clean(Math.sin(angle));commands.push(`BT /F${bold?2:1} ${size} Tf ${cos} ${sin} ${clean(-sin)} ${cos} ${clean(tx)} ${clean(y)} Tm (${safe}) Tj ET`)};
  rect(24,24,page.width-48,page.height-48,1.2);rect(32,32,page.width-64,page.height-64,.4);
  text(42,page.height-54,"VIVAD",18,true);text(111,page.height-52,"VivaFrame scaled fabrication drawing",11,true);text(page.width-42,page.height-52,"A3",12,true,true);
  braces.forEach(brace=>{const a=map(brace.start),b=map(brace.end),width=Math.max(brace.kind==="h-brace"?1.8:1,brace.widthMm*factor);line(a,b,width,brace.kind==="h-brace"?.32:.55)});
  designs.forEach(design=>{const points=pointsFor(design);design.segments.forEach((segment,index)=>line(map(points[index]),map(points[index+1]),Math.max(2.2,profileHeightMm*factor),.12))});
  const facing=profileFacingSides(designs);
  designs.forEach((design,seriesIndex)=>{const points=pointsFor(design);design.segments.forEach((segment,index)=>{const a=map(points[index]),b=map(points[index+1]),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,outward=facing[seriesIndex],nx=-dy/length*outward,ny=dx/length*outward,offset=15,da={x:a.x+nx*offset,y:a.y+ny*offset},db={x:b.x+nx*offset,y:b.y+ny*offset};line(a,{x:a.x+nx*(offset+4),y:a.y+ny*(offset+4)},.45,.5);line(b,{x:b.x+nx*(offset+4),y:b.y+ny*(offset+4)},.45,.5);line(da,db,.55,.35);line({x:da.x-nx*3,y:da.y-ny*3},{x:da.x+nx*3,y:da.y+ny*3},.55,.35);line({x:db.x-nx*3,y:db.y-ny*3},{x:db.x+nx*3,y:db.y+ny*3},.55,.35);const angle=Math.abs(dx)>=Math.abs(dy)?0:Math.PI/2,labelX=(da.x+db.x)/2+nx*4,labelY=(da.y+db.y)/2+ny*4-(angle?segment.length.toLocaleString().length*2.3:0);text(labelX,labelY,`${segment.length.toLocaleString("en-AU")} mm`,8,true,true,angle)})});
  braces.forEach(brace=>{const a=map(brace.start),b=map(brace.end),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,label=`${brace.kind==="h-brace"?"H":"MINI"} ${brace.lengthMm.toLocaleString("en-AU")} mm`;text(mx,my+5,label,7,true,true,Math.abs(b.x-a.x)<Math.abs(b.y-a.y)?Math.PI/2:0)});
  const titleX=730,titleY=38,titleW=428,titleH=100;rect(titleX,titleY,titleW,titleH,1);line({x:titleX,y:titleY+68},{x:titleX+titleW,y:titleY+68},.5);line({x:titleX,y:titleY+36},{x:titleX+titleW,y:titleY+36},.5);line({x:titleX+285,y:titleY},{x:titleX+285,y:titleY+68},.5);text(titleX+10,titleY+78,ascii(title)||"VivaFrame frame",13,true);text(titleX+10,titleY+51,`Profile: ${profileLabel}`,8);text(titleX+10,titleY+19,`Overall: ${stats.width.toLocaleString("en-AU")} x ${stats.height.toLocaleString("en-AU")} mm`,8);text(titleX+295,titleY+51,`Quantity: ${quantity}`,8);text(titleX+295,titleY+19,`Scale 1:${scale}`,10,true);text(44,52,`Brace schedule: ${braces.filter(item=>item.kind==="h-brace").length} H Brace, ${braces.filter(item=>item.kind==="mini-brace").length} Mini Brace`,8);text(44,38,`Generated ${new Intl.DateTimeFormat("en-AU",{dateStyle:"medium"}).format(options.generatedAt??new Date())}`,7);
  return makePdf(commands.join("\n"));
}

export function downloadFrameDrawingPdf(options:DrawingPdfOptions,filename="vivaframe-a3-drawing.pdf"){
  const bytes=createFrameDrawingPdf(options),blob=new Blob([bytes],{type:"application/pdf"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.hidden=true;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
