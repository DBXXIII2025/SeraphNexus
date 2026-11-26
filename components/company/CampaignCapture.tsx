"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {campaignKeys,cleanCampaign} from "@/lib/campaignAttribution";
export const CAMPAIGN_STORAGE_KEY="seraphcore_campaign";
export default function CampaignCapture(){
 const path=usePathname();
 useEffect(()=>{
  const query=new URLSearchParams(window.location.search);
  const campaign=cleanCampaign(Object.fromEntries(campaignKeys.map(k=>[k,query.get(k)])));
  if(Object.keys(campaign).length){try{sessionStorage.setItem(CAMPAIGN_STORAGE_KEY,JSON.stringify(campaign));}catch{/* Storage may be disabled. */}}
 },[path]);
 return null;
}
