import Link from "next/link";
import type { ReactNode } from "react";
export function CompanyPage({eyebrow,title,description,children}: {eyebrow:string;title:string;description:string;children:ReactNode}) {
 return <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24"><p className="sc-eyebrow">{eyebrow}</p><h1 className="sc-heading mt-5 max-w-4xl">{title}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#c1b8cd]">{description}</p><div className="mt-12">{children}</div></div>;
}
export function ProjectCTA({service}: {service?:string}) {
 return <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-[#c5a4ff]/20 bg-[#1a1127] p-6 sm:p-10"><div><h2 className="text-2xl font-semibold">Ready to discuss your project?</h2><p className="mt-2 text-[#c1b8cd]">Tell us what you need. We can work out the right scope together.</p></div><Link className="sc-primary" href={service?"/contact?service="+encodeURIComponent(service):"/contact"}>Start a project ↗</Link></div>;
}
