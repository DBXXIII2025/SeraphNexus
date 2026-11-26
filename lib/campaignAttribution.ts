export const campaignKeys=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"] as const;
export type CampaignAttribution=Partial<Record<typeof campaignKeys[number],string>>;
export function cleanCampaign(input:unknown):CampaignAttribution {
 const out:CampaignAttribution={};
 if(!input||typeof input!=="object")return out;
 const data=input as Record<string,unknown>;
 for(const key of campaignKeys){const v=data[key];if(typeof v==="string"&&v.trim())out[key]=v.trim().replace(/[\u0000-\u001f\u007f]/g,"").slice(0,120);}
 return out;
}
