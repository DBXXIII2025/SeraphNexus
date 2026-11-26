import { companyMetadata } from "@/lib/companySeo";
import Link from "next/link";
import { companyServices } from "@/lib/companySite";
import { CompanyPage, ProjectCTA } from "@/components/company/CompanyPage";
export const metadata = companyMetadata("Business technology services", "AI engineering, custom software, website development, SEO and digital growth for businesses in Texas and nationwide.", "/services");
export default function Services(){return <CompanyPage eyebrow="Our capabilities" title="Engineering for your next stage of growth." description="Choose the right starting point for your business, from a new website to a connected software system."><div className="grid gap-5 md:grid-cols-2">{companyServices.map((s,i)=><Link key={s.slug} href={"/services/"+s.slug} className="sc-panel block"><span className="sc-eyebrow">0{i+1}</span><h2 className="mt-5 text-2xl font-semibold">{s.title}</h2><p className="mt-3 leading-7 text-[#c1b8cd]">{s.description}</p><span className="mt-6 inline-block text-[#c5a4ff]">Explore service ↗</span></Link>)}</div><ProjectCTA/></CompanyPage>}
