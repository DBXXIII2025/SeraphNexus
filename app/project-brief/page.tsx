"use client";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

export default function ProjectBrief() {
  const [brief,setBrief]=useState("");
  const [copied,setCopied]=useState(false);
  const email=process.env.NEXT_PUBLIC_SERAPHCORE_CONTACT_EMAIL;
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    setBrief(["SeraphCore project inquiry", ...["Name","Business","Email","Service","Budget","Goals"].map(key=>key+": "+String(data.get(key)||""))].join("\n"));
    setCopied(false);
  }
  const field="mt-2 block w-full rounded-xl border border-white/20 bg-[#20172c] p-3 text-white";
  return <div className="min-h-screen bg-[#0c0a12] px-6 py-12 text-white"><div className="mx-auto max-w-2xl"><Link href="/" className="text-[#c5a4ff]">← SeraphCore home</Link><h1 className="mt-8 text-4xl font-semibold">Tell us about your project.</h1><p className="mt-4 text-[#c1b8cd]">Prepare a brief locally before sharing it. Nothing is submitted automatically.</p><form onSubmit={prepare} className="mt-8 space-y-5"><label className="block">Your name<input name="Name" required maxLength={120} autoComplete="name" className={field}/></label><label className="block">Business<input name="Business" required maxLength={160} autoComplete="organization" className={field}/></label><label className="block">Email<input name="Email" type="email" required maxLength={254} autoComplete="email" className={field}/></label><label className="block">Service<select name="Service" className={field}>{["Website development","AI automation","Custom software","SEO and digital growth","Not sure yet"].map(x=><option key={x}>{x}</option>)}</select></label><label className="block">Budget<select name="Budget" className={field}>{["Not decided","Under $500","$500–$1,500","$1,500–$5,000","$5,000+"].map(x=><option key={x}>{x}</option>)}</select></label><label className="block">Project goals<textarea name="Goals" required maxLength={3000} rows={5} className={field}/></label><button type="submit" className="rounded-full bg-[#c5a4ff] px-6 py-3 font-semibold text-[#170e24]">Prepare brief</button></form>{brief&&<section aria-live="polite" className="mt-8 rounded-2xl border border-white/20 p-6"><h2 className="text-xl font-semibold">Your project brief</h2><pre className="mt-4 whitespace-pre-wrap break-words text-sm text-[#d1c7df]">{brief}</pre><div className="mt-5 flex flex-wrap gap-4"><button type="button" className="rounded-full border border-white/30 px-5 py-2" onClick={async()=>{try{await navigator.clipboard.writeText(brief);setCopied(true)}catch{setCopied(false)}}}>{copied?"Copied":"Copy brief"}</button>{email&&<a className="rounded-full bg-[#c5a4ff] px-5 py-2 text-[#170e24]" href={"mailto:"+email+"?subject="+encodeURIComponent("SeraphCore project inquiry")+"&body="+encodeURIComponent(brief)}>Open email draft</a>}</div>{!email&&<p className="mt-4 text-sm text-[#c1b8cd]">Email delivery is not configured yet. Copy this brief and share it through your existing SeraphCore contact.</p>}</section>}</div></div>;
}
