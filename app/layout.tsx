import type { Metadata } from "next";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/open-sans/700.css";
import "@fontsource/cabin/600.css";
import "@fontsource/cabin/700.css";
import "./globals.css";
export const metadata:Metadata={metadataBase:new URL(process.env.URL||"http://localhost:3000"),title:"VivaFrame Designer",description:"Vivad visual frame design workspace",icons:{icon:"/favicon.svg"},openGraph:{title:"VivaFrame Designer",description:"Design. Measure. Price.",images:["/og.png"]},twitter:{card:"summary_large_image",title:"VivaFrame Designer",description:"Design. Measure. Price.",images:["/og.png"]}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
