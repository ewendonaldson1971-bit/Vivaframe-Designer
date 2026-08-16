import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { connectFramePricing, quoteFrame, type FramePricingProvider } from "../lib/pricing-client.ts";
import type { FrameTakeoff } from "../lib/geometry.ts";

const takeoff:FrameTakeoff = {profileId:"ss25",finishId:"natural-anodised",quantity:1,cutPieces:[],accessories:[]};

function installWindow(provider?:FramePricingProvider){
  Object.defineProperty(globalThis,"window",{configurable:true,value:{VivaFramePricingProvider:provider}});
}

afterEach(()=>{delete (globalThis as {window?:unknown}).window});

test("reports a disconnected state when the host supplies no pricing context",async()=>{
  installWindow();
  assert.equal(await connectFramePricing(()=>assert.fail("config should not be applied")),false);
});

test("passes the vivaframe product and takeoff through the host provider",async()=>{
  const calls:string[]=[];
  installWindow({
    async loadConfig(product){calls.push(`config:${product}`);return {config:{version:"test"},version:1}},
    async quote(product,received){calls.push(`quote:${product}`);assert.equal(received,takeoff);return {total:123,currency:"AUD"}},
  });
  let applied:unknown;
  assert.equal(await connectFramePricing(config=>{applied=config}),true);
  assert.deepEqual(applied,{version:"test"});
  assert.deepEqual(await quoteFrame(takeoff),{total:123,currency:"AUD"});
  assert.deepEqual(calls,["config:vivaframe","quote:vivaframe"]);
});
