import type { FrameTakeoff } from "./geometry";

const DEFAULT_API_BASE = "https://vivadpricing-app.calmtree-53cc02bb.australiasoutheast.azurecontainerapps.io";
const BRIDGE_ORIGIN = "https://vivalux4-client.netlify.app";
const PRODUCT_KEY = "vivaframe";

export type FramePricingConfig = Record<string, unknown>;
export type FramePricingQuote = { subtotal?:number; tax?:number; total?:number; currency?:string; lines?:unknown[]; calculatedAt?:string; [key:string]:unknown };
export type FramePricingProvider = {
  loadConfig(product:string):Promise<{config?:FramePricingConfig;version?:string|number}>;
  quote(product:string,takeoff:FrameTakeoff):Promise<FramePricingQuote>;
};
type VivaluxPricingService = {
  register(product:string,apply:(config:FramePricingConfig)=>void):Promise<boolean>;
  quote(product:string,takeoff:FrameTakeoff):Promise<FramePricingQuote>;
};
type BridgeResponse = { source?:string;ready?:boolean;id?:string;result?:unknown;error?:string };

declare global {
  interface Window {
    VivaFramePricingProvider?: FramePricingProvider;
    VivaFramePricingContext?: { token:string; apiBase?:string };
    VivaluxPricing?: VivaluxPricingService;
  }
}

function vivaluxProvider(service:VivaluxPricingService):FramePricingProvider {
  return {
    loadConfig:(product)=>new Promise((resolve,reject)=>{
      let settled=false;
      const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error("VivaFrame pricing configuration is unavailable."))}},10000);
      service.register(product,(config)=>{if(!settled){settled=true;clearTimeout(timer);resolve({config})}}).then(connected=>{
        if(!connected&&!settled){settled=true;clearTimeout(timer);reject(new Error("VivaFrame pricing configuration is unavailable."))}
      }).catch(error=>{if(!settled){settled=true;clearTimeout(timer);reject(error)}});
    }),
    quote:(product,takeoff)=>service.quote(product,takeoff),
  };
}

function directProvider(context:{token:string;apiBase?:string}):FramePricingProvider {
  const apiBase=(context.apiBase||DEFAULT_API_BASE).replace(/\/$/,"");
  const request=async(path:string,init?:RequestInit)=>{
    const response=await fetch(`${apiBase}${path}`,{...init,headers:{Authorization:`Bearer ${context.token}`,Accept:"application/json",...(init?.headers||{})}});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||"Pricing Engine is unavailable.");
    return payload;
  };
  return {
    loadConfig:(product)=>request(`/api/v1/config/vivalux?product=${encodeURIComponent(product)}`),
    quote:(product,takeoff)=>request("/api/v1/pricing/vivalux/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({product,takeoff})}),
  };
}

let popupProvider:FramePricingProvider|null=null;
let pricingPopup:Window|null=null;
async function openBridgeProvider():Promise<FramePricingProvider> {
  if(typeof window==="undefined")throw new Error("Pricing connection is available in the browser.");
  pricingPopup=window.open(`${BRIDGE_ORIGIN}/pricing-bridge.html`,"vivalux-pricing-bridge","popup,width=460,height=260");
  if(!pricingPopup)throw new Error("Allow the Vivalux pricing window, then try again.");
  const pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  let readyResolve!:()=>void;
  let readyReject!:(error:Error)=>void;
  const ready=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject});
  const readyTimer=setTimeout(()=>readyReject(new Error("Open Vivalux Builder and sign in to connect customer pricing.")),10000);
  const receive=(event:MessageEvent)=>{
    if(event.origin!==BRIDGE_ORIGIN||event.source!==pricingPopup)return;
    const response=event.data as BridgeResponse;
    if(response.source!=="vivalux-pricing-bridge")return;
    if(response.ready){clearTimeout(readyTimer);readyResolve();return}
    if(!response.id)return;
    const request=pending.get(response.id);
    if(!request)return;
    clearTimeout(request.timer);pending.delete(response.id);
    if(response.error)request.reject(new Error(response.error));else request.resolve(response.result);
  };
  window.addEventListener("message",receive);
  const request=async(action:"config"|"quote",takeoff?:FrameTakeoff)=>{
    await ready;
    if(!pricingPopup||pricingPopup.closed)throw new Error("Reopen the Vivalux pricing connection.");
    const id=`vivaframe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise<unknown>((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error("Pricing Engine did not respond."))},15000);
      pending.set(id,{resolve,reject,timer});
      pricingPopup?.postMessage({source:"vivaframe-designer",id,action,takeoff},BRIDGE_ORIGIN);
    });
  };
  popupProvider={
    loadConfig:async()=>await request("config") as {config?:FramePricingConfig},
    quote:async(_product,takeoff)=>await request("quote",takeoff) as FramePricingQuote,
  };
  await ready;
  return popupProvider;
}

function provider(){return window.VivaFramePricingProvider||(window.VivaluxPricing?vivaluxProvider(window.VivaluxPricing):null)||(window.VivaFramePricingContext?.token?directProvider(window.VivaFramePricingContext):null)||(pricingPopup&&!pricingPopup.closed?popupProvider:null)}
export async function connectFramePricing(apply:(config:FramePricingConfig)=>void){const active=provider();if(!active)return false;const payload=await active.loadConfig(PRODUCT_KEY);if(!payload?.config)return false;apply(payload.config);return true}
export async function connectFramePricingInteractively(apply:(config:FramePricingConfig)=>void){const active=await openBridgeProvider();const payload=await active.loadConfig(PRODUCT_KEY);if(!payload?.config)return false;apply(payload.config);return true}
export async function quoteFrame(takeoff:FrameTakeoff){const active=provider();if(!active)throw new Error("Pricing Engine context is not connected.");const payload=await active.quote(PRODUCT_KEY,takeoff);const calculation=payload.calculation&&typeof payload.calculation==="object"?payload.calculation as FramePricingQuote:payload;const rawTotal=calculation.total;const total=typeof rawTotal==="number"?rawTotal:rawTotal&&typeof rawTotal==="object"&&"sell" in rawTotal?Number((rawTotal as {sell:unknown}).sell):undefined;return {...calculation,...(typeof total==="number"&&Number.isFinite(total)?{total}:{})}}
