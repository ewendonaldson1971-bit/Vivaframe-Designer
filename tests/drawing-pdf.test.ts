import test from "node:test";
import assert from "node:assert/strict";
import { createFrameDrawingPdf } from "../lib/drawing-pdf.ts";
import { rectangle, type BracePiece } from "../lib/geometry.ts";

test("creates a landscape A3 vector drawing with scale and dimensions",()=>{
  const braces:BracePiece[]=[{id:"b1",kind:"mini-brace",orientation:"vertical",start:{x:1200,y:0},end:{x:1200,y:1800},lengthMm:1800,widthMm:25,tensionLocks:2}];
  const pdf=createFrameDrawingPdf({designs:[rectangle(2400,1800)],braces,title:"Test frame",profileLabel:"VivaFrame SS25",profileHeightMm:40,quantity:1,generatedAt:new Date("2026-08-17T00:00:00Z")}),content=new TextDecoder().decode(pdf);
  assert.equal(content.startsWith("%PDF-1.4"),true);
  assert.match(content,/\/MediaBox \[0 0 1190\.55 841\.89\]/);
  assert.match(content,/\(2,400 mm\)/);
  assert.match(content,/\(MINI 1,800 mm\)/);
  assert.match(content,/\(Scale 1:10\)/);
  assert.equal(content.endsWith("%%EOF\n"),true);
});
