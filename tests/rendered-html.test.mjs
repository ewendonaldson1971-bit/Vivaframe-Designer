import assert from "node:assert/strict";
import test from "node:test";

async function render(path="/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, {headers:{accept:"text/html"}}), {ASSETS:{fetch:async()=>new Response("Not found",{status:404})}}, {waitUntil(){},passThroughOnException(){}});
}
test("server-renders the integrated VivaFrame application without its own login",async()=>{const response=await render();assert.equal(response.status,200);const html=await response.text();assert.match(html,/<title>VivaFrame Designer<\/title>/);assert.match(html,/aria-label="Application pages"/);assert.match(html,/Build Preview/);assert.match(html,/Construction history/);assert.match(html,/Pricing managed by Vivalux Builder/);assert.doesNotMatch(html,/codex-preview|react-loading-skeleton|Sign in to load pricing/)});
test("supports direct linking to the designer",async()=>{const response=await render("/vivaframe");assert.equal(response.status,200);const html=await response.text();assert.match(html,/VivaFrame Designer/);assert.match(html,/Cut list/);assert.match(html,/BOM/)});
