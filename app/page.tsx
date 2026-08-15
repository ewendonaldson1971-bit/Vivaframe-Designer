import type { Metadata } from "next";
import Designer from "./Designer";
export const metadata: Metadata = { title: "VivaFrame Designer", description: "Design orthogonal VivaFrame aluminium extrusion frames." };
export default function Home(){ return <Designer/>; }
