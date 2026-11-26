import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { getPublicBusinessHrefState } from "@/lib/publicBusinessRoutes";
import { SITE_URL } from "@/lib/companySeo";

export async function publicBusinessMetadata(slug:string):Promise<Metadata> {
 try {
  const db=createAdminClient();
  const {data,error}=await db.from("businesses").select("name,description,slug,business_type").eq("slug",slug).eq("is_published",true).maybeSingle();
  if(error||!data||!data.name) return {title:"Business unavailable",robots:{index:false,follow:false}};
  const route=getPublicBusinessHrefState({slug:data.slug,businessType:data.business_type});
  if(!route.isRoutable) return {title:"Business unavailable",robots:{index:false,follow:false}};
  const url=SITE_URL+route.href;
  const description=String(data.description||"").replace(/\s+/g," ").trim().slice(0,200)||("Explore "+data.name+" on the SeraphNexus marketplace.");
  const title=data.name+" | SeraphNexus";
  return {title:{absolute:title},description,alternates:{canonical:url},robots:{index:true,follow:true},openGraph:{type:"website",siteName:"SeraphNexus",title,description,url,images:[{url:"/api/social-image",width:1200,height:630,alt:"SeraphCore Technologies"}]},twitter:{card:"summary_large_image",title,description,images:["/api/social-image"]}};
 } catch {return {title:"Business unavailable",robots:{index:false,follow:false}};}
}
