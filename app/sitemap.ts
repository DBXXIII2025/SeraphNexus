import type {MetadataRoute} from "next";
import {companyServices} from "@/lib/companySite";
import {SITE_URL} from "@/lib/companySeo";
import {createAdminClient} from "@/lib/supabase/server";
import {getPublicBusinessHrefState} from "@/lib/publicBusinessRoutes";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const paths=new Set(["/","/services","/products","/portfolio","/about","/contact","/nexus","/explore","/pricing",...companyServices.map(s=>"/services/"+s.slug)]);
 try{const db=createAdminClient();for(let offset=0;offset<49000;offset+=500){const {data,error}=await db.from("businesses").select("slug,business_type").eq("is_published",true).order("id").range(offset,offset+499);if(error||!data)break;for(const business of data){if(!business.slug||! /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(business.slug))continue;const route=getPublicBusinessHrefState({slug:business.slug,businessType:business.business_type});if(route.isRoutable)paths.add(route.href);}if(data.length<500)break;}}catch{/* Company pages remain discoverable during database outages. */}
 return [...paths].map(path=>({url:SITE_URL+path}));
}
