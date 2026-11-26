import Link from "next/link";
import { notFound } from "next/navigation";
import { companyServices } from "@/lib/companySite";
import { CompanyPage, ProjectCTA } from "@/components/company/CompanyPage";
type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return companyServices.map(s=>({slug:s.slug}));}
export async function generateMetadata({params}:Props){const {slug}=await params;const s=companyServices.find(x=>x.slug===slug);return s?{title:{absolute:s.title+" | SeraphCore Technologies"},description:s.description,alternates:{canonical:"/services/"+slug}}:{};}
export default async function Service({params}:Props){const {slug}=await params;const s=companyServices.find(x=>x.slug===slug);if(!s)notFound();return <CompanyPage eyebrow="SeraphCore services" title={s.title} description={s.description}><Link href="/services" className="text-sm text-[#c5a4ff]">← All services</Link><div className="mt-8 grid gap-5 md:grid-cols-3">{s.outcomes.map(x=><article key={x} className="sc-panel"><h2 className="text-xl font-semibold">{x}</h2><p className="mt-4 text-[#c1b8cd]">Scoped to your goals, existing systems and agreed deliverables.</p></article>)}</div><ProjectCTA service={s.slug}/></CompanyPage>}
