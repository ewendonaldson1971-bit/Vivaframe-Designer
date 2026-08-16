import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";

const port=3400+(process.pid%500);
let server;
before(async()=>{
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{cwd:new URL("..",import.meta.url),stdio:["ignore","pipe","pipe"]});
  let output="";server.stdout.on("data",chunk=>output+=chunk);server.stderr.on("data",chunk=>output+=chunk);
  for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(`http://127.0.0.1:${port}/`);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
  throw new Error(`Next.js test server did not start. ${output}`);
});
after(()=>server?.kill());
async function render(path="/") {
  return fetch(`http://127.0.0.1:${port}${path}`,{headers:{accept:"text/html"}});
}
test("server-renders the integrated VivaFrame application without its own login",async()=>{const response=await render();assert.equal(response.status,200);const html=await response.text();assert.match(html,/<title>VivaFrame Designer<\/title>/);assert.match(html,/aria-label="Application pages"/);assert.match(html,/Build Preview/);assert.match(html,/Construction history/);assert.match(html,/Pricing managed by Vivalux Builder/);assert.doesNotMatch(html,/codex-preview|react-loading-skeleton|Sign in to load pricing/)});
test("supports direct linking to the designer",async()=>{const response=await render("/vivaframe");assert.equal(response.status,200);const html=await response.text();assert.match(html,/VivaFrame Designer/);assert.match(html,/Cut list/);assert.match(html,/BOM/)});
