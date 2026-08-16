import type { FrameTakeoff } from "./geometry";

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_PRICING_API_URL || "https://vivadpricing-app.calmtree-53cc02bb.australiasoutheast.azurecontainerapps.io";
const TOKEN_KEY = "vivaFramePricingToken";
const USER_KEY = "vivaFramePricingUser";
const PRODUCT_KEY = "vivaframe";

export type ExtrusionConfigRow = { id:string; extrusion:string; weight:number; width:number; height:number; unit:string; priceSilver:number; braceOffset:number|null; horizontalCrossBraceSpacing:number|null; verticalCrossBraceSpacing:number|null };
export type EligibleExtrusionConfigRow = { id:string; label:string; extrusionId:string|null; enabled:boolean; position:number; source:ExtrusionConfigRow|null };
export type FramePricingConfig = { extrusions:ExtrusionConfigRow[]; eligibleExtrusions:EligibleExtrusionConfigRow[]; [key:string]:unknown };
export type FramePricingQuote = { subtotal?:number; discount?:number; tax?:number; total?:number; currency?:string; lines?:unknown[]; calculatedAt?:string; [key:string]:unknown };
export type FramePricingProvider = {
  loadConfig(product:string):Promise<{config?:FramePricingConfig;version?:string|number}>;
  quote(product:string,takeoff:FrameTakeoff):Promise<FramePricingQuote>;
};

declare global {
  interface Window { VivaFramePricingProvider?: FramePricingProvider }
}

function storage(){ return typeof window !== "undefined" ? window.sessionStorage : undefined }
function apiBase(){ return DEFAULT_API_BASE.replace(/\/$/,"") }
function token(){ return storage()?.getItem(TOKEN_KEY) || "" }

function clearStoredSession(){
  storage()?.removeItem(TOKEN_KEY);
  storage()?.removeItem(USER_KEY);
}

async function request(path:string,init?:RequestInit,authToken=token()){
  const response=await fetch(`${apiBase()}${path}`,{...init,headers:{Accept:"application/json",...(authToken?{Authorization:`Bearer ${authToken}`}:{ }),...(init?.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(response.status===401&&authToken){clearStoredSession();throw new Error("Your Pricing Engine session has expired. Please connect again.")}
  if(!response.ok)throw new Error(payload.error||"Pricing Engine is unavailable.");
  return payload;
}

function directProvider():FramePricingProvider|null {
  if(!token())return null;
  return {
    loadConfig:()=>request("/api/v1/config/vivaframe"),
    quote:(_product,takeoff)=>request("/api/v1/pricing/vivaframe/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({takeoff})}),
  };
}

function provider(){ return window.VivaFramePricingProvider || directProvider() }

export function pricingUsername(){ return storage()?.getItem(USER_KEY) || "" }

export async function connectFramePricing(apply:(config:FramePricingConfig)=>void){
  const active=provider();
  if(!active)return false;
  const payload=await active.loadConfig(PRODUCT_KEY);
  if(!payload?.config)return false;
  apply(payload.config);
  return true;
}

export async function loginFramePricing(username:string,password:string,apply:(config:FramePricingConfig)=>void){
  const payload=await request("/api/auth/token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})},"");
  if(!payload.token)throw new Error("The Pricing Engine did not return a session token.");
  storage()?.setItem(TOKEN_KEY,payload.token);
  storage()?.setItem(USER_KEY,payload.user?.username||username);
  const connected=await connectFramePricing(apply);
  if(!connected){clearStoredSession();throw new Error("VivaFrame pricing configuration is unavailable.")}
  return payload.user?.username||username;
}

export function disconnectFramePricing(){ clearStoredSession() }

export async function quoteFrame(takeoff:FrameTakeoff){
  const active=provider();
  if(!active)throw new Error("Pricing Engine context is not connected.");
  return active.quote(PRODUCT_KEY,takeoff);
}
