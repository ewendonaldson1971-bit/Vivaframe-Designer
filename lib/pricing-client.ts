import type { FrameTakeoff } from "./geometry";

const DEFAULT_API_BASE = "https://vivadpricing-app.calmtree-53cc02bb.australiasoutheast.azurecontainerapps.io";
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

function provider(){return window.VivaFramePricingProvider||(window.VivaluxPricing?vivaluxProvider(window.VivaluxPricing):null)||(window.VivaFramePricingContext?.token?directProvider(window.VivaFramePricingContext):null)}
export async function connectFramePricing(apply:(config:FramePricingConfig)=>void){const active=provider();if(!active)return false;const payload=await active.loadConfig(PRODUCT_KEY);if(!payload?.config)return false;apply(payload.config);return true}
export async function quoteFrame(takeoff:FrameTakeoff){const active=provider();if(!active)throw new Error("Pricing Engine context is not connected.");return active.quote(PRODUCT_KEY,takeoff)}
