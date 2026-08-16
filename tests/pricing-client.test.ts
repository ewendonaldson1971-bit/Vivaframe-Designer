import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { connectFramePricing, disconnectFramePricing, loginFramePricing, pricingUsername, quoteFrame, type FramePricingProvider } from "../lib/pricing-client.ts";
import type { FrameTakeoff } from "../lib/geometry.ts";

const takeoff:FrameTakeoff = {profileId:"ss25",finishId:"natural-anodised",quantity:1,cutPieces:[],accessories:[]};

function installWindow(value:Record<string,unknown>={}){
  Object.defineProperty(globalThis,"window",{configurable:true,value});
}

afterEach(()=>{delete (globalThis as {window?:unknown}).window;delete (globalThis as {fetch?:unknown}).fetch});

test("reports a disconnected state when the host supplies no pricing context",async()=>{
  installWindow();
  assert.equal(await connectFramePricing(()=>assert.fail("config should not be applied")),false);
});

test("passes the vivaframe product and takeoff through the host provider",async()=>{
  const calls:string[]=[];
  installWindow({VivaFramePricingProvider:{
    async loadConfig(product){calls.push(`config:${product}`);return {config:{version:"test"},version:1}},
    async quote(product,received){calls.push(`quote:${product}`);assert.equal(received,takeoff);return {total:123,currency:"AUD"}},
  } satisfies FramePricingProvider});
  let applied:unknown;
  assert.equal(await connectFramePricing(config=>{applied=config}),true);
  assert.deepEqual(applied,{version:"test"});
  assert.deepEqual(await quoteFrame(takeoff),{total:123,currency:"AUD"});
  assert.deepEqual(calls,["config:vivaframe","quote:vivaframe"]);
});

test("uses the SAV Builder login pattern and dedicated VivaFrame endpoints",async()=>{
  const values=new Map<string,string>(),calls:string[]=[];
  installWindow({sessionStorage:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
  Object.defineProperty(globalThis,"fetch",{configurable:true,value:async(url:string,init?:RequestInit)=>{
    calls.push(`${init?.method||"GET"} ${new URL(url).pathname}`);
    if(url.endsWith("/api/auth/token"))return Response.json({token:"short-lived-token",user:{username:"ewen"}});
    if(url.endsWith("/api/v1/config/vivaframe")){assert.equal((init?.headers as Record<string,string>).Authorization,"Bearer short-lived-token");return Response.json({config:{extrusions:[],eligibleExtrusions:[{id:"vivaframe-ss25",label:"VivaFrame SS25",extrusionId:"extrusion-008",enabled:true,position:0,source:null}]}})}
    if(url.endsWith("/api/v1/pricing/vivaframe/quote"))return Response.json({total:456,currency:"AUD"});
    return Response.json({error:"not found"},{status:404});
  }});
  let applied:unknown;
  assert.equal(await loginFramePricing("ewen","password",config=>{applied=config}),"ewen");
  assert.deepEqual(applied,{extrusions:[],eligibleExtrusions:[{id:"vivaframe-ss25",label:"VivaFrame SS25",extrusionId:"extrusion-008",enabled:true,position:0,source:null}]});
  assert.equal(pricingUsername(),"ewen");
  assert.deepEqual(await quoteFrame(takeoff),{total:456,currency:"AUD"});
  assert.deepEqual(calls,["POST /api/auth/token","GET /api/v1/config/vivaframe","POST /api/v1/pricing/vivaframe/quote"]);
  disconnectFramePricing();
  assert.equal(pricingUsername(),"");
});
