import {NextResponse} from "next/server";
import {sendEmail} from "@/lib/emailProvider";
import {cleanCampaign} from "@/lib/campaignAttribution";
import {companyServices} from "@/lib/companySite";
const budgets=["Not decided","Under $500","$500–$1,500","$1,500–$5,000","$5,000+"];
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
export async function POST(req:Request){
 const origin=req.headers.get("origin");if(!origin||origin!==new URL(req.url).origin&&origin!=="https://seraphnexus.com")return NextResponse.json({error:"Invalid request origin."},{status:403});
 if(!req.headers.get("content-type")?.startsWith("application/json"))return NextResponse.json({error:"Invalid request format."},{status:415});
 const to=process.env.SERAPHCORE_CONTACT_EMAIL||process.env.NEXT_PUBLIC_SERAPHCORE_CONTACT_EMAIL;
 if(!to||!emailPattern.test(to)||!process.env.RESEND_API_KEY||!(process.env.RESEND_FROM_EMAIL||process.env.RESEND_FROM))return NextResponse.json({error:"Inquiry delivery is temporarily unavailable. Please retain your brief and try again later."},{status:503});
 try{
 const raw=await req.text();if(raw.length>10000)return NextResponse.json({error:"Inquiry is too long."},{status:413});
 const d=JSON.parse(raw);if(!d||typeof d!=="object"||Array.isArray(d))return NextResponse.json({error:"Invalid inquiry."},{status:400});
 const field=(k:string,max:number)=>typeof d[k]==="string"&&d[k].trim().length<=max?d[k].trim():"";
 const name=field("name",120),business=field("business",160),email=field("email",254),service=field("service",80),budget=field("budget",80),goals=field("goals",3000);
 if(d.website)return NextResponse.json({error:"Invalid submission."},{status:400});
 const label=companyServices.find(x=>x.slug===service)?.title||(service==="unsure"?"Not sure yet":"");
 if(!name||!business||!emailPattern.test(email)||!label||!budgets.includes(budget)||!goals)return NextResponse.json({error:"Please check all required fields."},{status:400});
 const text=["Name: "+name,"Business: "+business,"Email: "+email,"Service: "+label,"Budget: "+budget,"Goals: "+goals,...Object.entries(cleanCampaign(d.campaign)).map(([key,value])=>key+": "+value)].join("\n");
 await sendEmail({to,subject:"New SeraphCore project inquiry",text,html:"<pre>"+escapeHtml(text)+"</pre>"});
 return NextResponse.json({ok:true});
 }catch{ return NextResponse.json({error:"We could not send your inquiry. Please try again."},{status:502});}
}
