import type { PricingTakeoff } from "./geometry";

export type VivaFrameConfig = { profiles?: unknown[]; finishes?: unknown[]; mappings?: Record<string,string>; [key:string]:unknown };
export type PricingQuote = { subtotal?:number; tax?:number; total?:number; currency?:string; lines?:unknown[]; calculatedAt?:string; [key:string]:unknown };
declare global { interface Window { VivaluxPricing?: { register(product:string,apply:(config:VivaFrameConfig,merge:unknown)=>void):Promise<boolean>; reload(product:string):Promise<boolean>; quote(product:string,takeoff:PricingTakeoff):Promise<PricingQuote> } } }
export const PRODUCT_KEY = "vivaframe";
export function registerVivaFrameConfig(apply:(config:VivaFrameConfig)=>void){ return window.VivaluxPricing?.register(PRODUCT_KEY,(config)=>apply(config)) ?? Promise.resolve(false); }
export function quoteVivaFrame(takeoff:PricingTakeoff){ if(!window.VivaluxPricing)return Promise.reject(new Error("Sign in to load pricing.")); return window.VivaluxPricing.quote(PRODUCT_KEY,takeoff); }
