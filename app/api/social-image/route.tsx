import { ImageResponse } from "next/og";
export const runtime = "nodejs";
export async function GET() {
 return new ImageResponse(
   <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",background:"linear-gradient(125deg,#0c0a12,#25143c)",color:"#f5f1fa",padding:66,border:"2px solid #403052"}}>
    <div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{fontSize:28,letterSpacing:6,color:"#d1b47a"}}>SERAPHCORE TECHNOLOGIES</div><div style={{display:"flex",width:92,height:5,background:"#c5a4ff"}}/></div>
    <div style={{display:"flex",flexDirection:"column",gap:24}}><div style={{fontSize:76,fontWeight:700,lineHeight:1.1,letterSpacing:-3}}>Technology built around your business.</div><div style={{fontSize:30,color:"#c5a4ff"}}>AI engineering · Software · Web development · Digital growth</div></div>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:23,color:"#c1b8cd"}}><span>Rio Grande Valley · Nationwide</span><span>seraphnexus.com</span></div>
   </div>,{width:1200,height:630,headers:{"Cache-Control":"public, max-age=86400, s-maxage=86400"}});
}
