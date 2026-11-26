"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type { ReactNode } from "react";

const links = [["/services","Services"],["/products","Products"],["/portfolio","Portfolio"],["/about","About"],["/contact","Contact"]];
export default function CompanyShell({children}: {children: ReactNode}) {
 const pathname=usePathname();
 return <div className="sc-company min-h-screen bg-[#0c0a12] text-[#f5f1fa]">
 <header className="border-b border-white/10 bg-[#100d18]"><nav aria-label="Company navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
 <Link href="/" className="flex items-center gap-3"><span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl border border-[#c5a4ff]/40 text-2xl text-[#c5a4ff]">✧</span><span className="font-semibold tracking-[.12em]">SERAPHCORE<span className="block text-[10px] tracking-[.24em] text-[#d1b47a]">TECHNOLOGIES</span></span></Link>
 <div className="hidden flex-wrap items-center gap-6 lg:flex">{links.map(([href,label])=><Link className="sc-nav" aria-current={pathname===href||pathname.startsWith(href+"/")?"page":undefined} key={href} href={href}>{label}</Link>)}<Link className="sc-primary" href="/contact">Start a project</Link></div>
 <details key={pathname} className="group relative lg:hidden"><summary className="cursor-pointer rounded-xl border border-white/20 px-4 py-3 text-sm">Menu</summary><div className="absolute right-0 z-50 mt-2 grid w-60 max-w-[80vw] gap-1 rounded-2xl border border-white/20 bg-[#181120] p-3 shadow-xl">{links.map(([href,label])=><Link className="rounded-lg px-3 py-3 hover:bg-white/10" key={href} href={href}>{label}</Link>)}<Link className="sc-primary" href="/contact">Start a project</Link></div></details>
 </nav></header>
 {children}
 <footer className="border-t border-white/10 bg-[#100d18]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-12"><div><p className="font-semibold tracking-wider">SERAPHCORE TECHNOLOGIES</p><p className="mt-3 text-sm text-[#c1b8cd]">Rio Grande Valley, Texas · Serving businesses nationwide.</p></div><div className="grid gap-3 text-sm">{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</div><div className="grid gap-3 text-sm"><a href="/nexus">SeraphNexus platform</a><a href="/explore">Marketplace</a><a href="/login">Platform sign in</a><a href="/legal/privacy_policy">Platform privacy policy</a><a href="/legal/terms_of_service">Platform terms</a></div></div><div className="mx-auto max-w-7xl border-t border-white/10 px-5 py-5 text-xs text-[#c1b8cd] sm:px-8 lg:px-12">© 2026 SeraphCore. All rights reserved.</div></footer></div>;
}
