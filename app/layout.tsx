import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
const geist = Geist({variable:"--font-ui",subsets:["latin"]});
export async function generateMetadata():Promise<Metadata>{const h=await headers();const host=h.get("x-forwarded-host")||h.get("host")||"localhost:3000";const protocol=h.get("x-forwarded-proto")||"http";const image=`${protocol}://${host}/og.png`;return{title:"VivaFrame Designer",description:"Vivad visual frame design workspace",icons:{icon:"/favicon.svg"},openGraph:{title:"VivaFrame Designer",description:"Design. Measure. Price.",images:[image]},twitter:{card:"summary_large_image",title:"VivaFrame Designer",description:"Design. Measure. Price.",images:[image]}}}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={geist.variable}>{children}</body></html>}
