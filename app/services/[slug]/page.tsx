import Link from "next/link";
import { notFound } from "next/navigation";
import { companyServices, serviceContent } from "@/lib/companySite";
import { companyMetadata, breadcrumb, ORGANIZATION_ID, SITE_URL } from "@/lib/companySeo";
import StructuredData from "@/components/company/StructuredData";
import { CompanyPage, ProjectCTA } from "@/components/company/CompanyPage";
type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return companyServices.map(s=>({slug:s.slug}));}
export async function generateMetadata({params}:Props){const {slug}=await params;const s=companyServices.find(x=>x.slug===slug);return s?companyMetadata(serviceContent[slug].headline,s.description,"/services/"+slug):{robots:{index:false,follow:false}};}
export default async function Service({params}:Props){
 const {slug}=await params;const s=companyServices.find(x=>x.slug===slug);if(!s)notFound();const c=serviceContent[slug];
 return <CompanyPage eyebrow="SeraphCore services" title={c.headline} description={c.intro}>
 <StructuredData data={{"@context":"https://schema.org","@type":"Service",name:s.title,description:c.intro,url:SITE_URL+"/services/"+slug,provider:{"@id":ORGANIZATION_ID},areaServed:[{"@type":"Place",name:"Rio Grande Valley, Texas"},{"@type":"Country",name:"United States"}]}}/>
 <StructuredData data={breadcrumb([{name:"Home",path:"/"},{name:"Services",path:"/services"},{name:s.title,path:"/services/"+slug}])}/>
 <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-[#c1b8cd]"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">{s.title}</span></nav>
 <div className="mt-8 grid gap-5 md:grid-cols-3">{s.outcomes.map((x,i)=><article key={x} className="sc-panel"><h2 className="text-xl font-semibold">{x}</h2><p className="mt-4 leading-7 text-[#c1b8cd]">{c.details[i]}</p></article>)}</div>
 <section className="mt-14 max-w-4xl"><h2 className="text-3xl font-semibold">Frequently asked questions</h2>{c.faq.map(([q,a])=><article key={q} className="mt-6 border-t border-white/10 pt-5"><h3 className="text-xl font-semibold">{q}</h3><p className="mt-3 leading-7 text-[#c1b8cd]">{a}</p></article>)}</section>
 <ProjectCTA service={s.slug}/><section className="mt-12"><h2 className="text-2xl font-semibold">Related services</h2><div className="mt-4 flex flex-wrap gap-3">{companyServices.filter(x=>x.slug!==slug).map(x=><Link key={x.slug} className="sc-secondary" href={"/services/"+x.slug}>{x.title}</Link>)}</div></section></CompanyPage>;
}
