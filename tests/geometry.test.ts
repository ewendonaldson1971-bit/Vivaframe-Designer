import test from "node:test";
import assert from "node:assert/strict";
import { endpoint, geometryIssues, isClosed, preparePricingTakeoff, rectangle, splitForStock, summary, turnHeading, type Design } from "../lib/geometry.ts";

test("relative turns resolve to absolute headings",()=>{assert.equal(turnHeading("N","left"),"W");assert.equal(turnHeading("E","right"),"S");assert.equal(turnHeading("S","straight"),"S")});
test("endpoints use integer millimetres",()=>{assert.deepEqual(endpoint({x:10,y:20},"W",1200),{x:-1190,y:20})});
test("closed rectangle dimensions and mitres",()=>{const d=rectangle(1200,800);assert.equal(isClosed(d),true);assert.deepEqual(summary(d),{width:1200,height:800,perimeter:4000,stock:1,waste:1600,corners:4,mitres:8,closed:true})});
test("segments over stock length split and require a straight joiner",()=>{assert.deepEqual(splitForStock(12000),[5600,5600,800]);const t=preparePricingTakeoff(rectangle(6000,800),"vf40","natural");assert.equal(t.cutPieces.length,6);assert.deepEqual(t.accessories.find(a=>a.mappingKey==="straight_joiner"),{mappingKey:"straight_joiner",quantity:2})});
test("self intersections are reported",()=>{const d:Design={start:{x:0,y:0},initialHeading:"E",segments:[{id:"a",heading:"E",length:1000,turn:"straight"},{id:"b",heading:"S",length:1000,turn:"right"},{id:"c",heading:"W",length:500,turn:"right"},{id:"d",heading:"N",length:1500,turn:"right"}]};assert.equal(geometryIssues(d).some(i=>i.type==="intersection"),true)});
test("overlapping collinear pieces are reported",()=>{const d:Design={start:{x:0,y:0},initialHeading:"E",segments:[{id:"a",heading:"E",length:1000,turn:"straight"},{id:"b",heading:"W",length:500,turn:"right"},{id:"c",heading:"W",length:800,turn:"straight"}]};assert.equal(geometryIssues(d).some(i=>i.type==="overlap"),true)});
test("pricing takeoff retains stable selections and no prices",()=>{const t=preparePricingTakeoff(rectangle(),"profile-id","finish-id",3);assert.equal(t.profileId,"profile-id");assert.equal(t.finishId,"finish-id");assert.equal(t.quantity,3);assert.equal("price" in t,false)});
