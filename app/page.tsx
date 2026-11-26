import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { companyServices } from "@/lib/companySite";

export const metadata: Metadata = {
  title: { absolute: "SeraphCore Technologies | AI, Software & Web Development" },
  description: "SeraphCore builds business websites, custom software, AI automation and digital growth solutions in the Rio Grande Valley and across the United States.",
  alternates: { canonical: "/" },
  openGraph: { title: "SeraphCore Technologies", description: "Technology built around your business.", siteName: "SeraphCore Technologies", type: "website", url: "/" },
  twitter: { card: "summary", title: "SeraphCore Technologies", description: "AI, software and web development for businesses." },
};

const questions = [
  ["Who do you work with?", "Small and growing businesses in the Rio Grande Valley and across the United States."],
  ["Can you improve an existing website?", "Yes. We can assess your existing website and recommend targeted improvements or a rebuild based on your goals."],
  ["How much does a project cost?", "Pricing depends on scope, integrations and ongoing support. We agree on deliverables and pricing before development begins."],
  ["Do you offer ongoing support?", "Maintenance and ongoing improvements can be included in a separate support agreement."],
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0c0a12] text-[#f5f1fa]">
      <section className="sc-hero relative isolate overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_35%,#362052_0%,transparent_55%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-[1.25fr_1fr] lg:px-12 lg:py-32">
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[.28em] text-[#d1b47a]">Intelligence · Engineering · Growth</p>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">Technology built around <span className="text-[#c5a4ff]">your business.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#c1b8cd]">From a better website to intelligent automation, we engineer practical digital solutions that help businesses win customers and simplify operations.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Link href="/contact" className="sc-primary">Plan your project ↗</Link><Link href="/portfolio" className="sc-secondary">Explore our work</Link></div>
            <p className="mt-8 text-sm text-[#b7acc6]">Based in the Rio Grande Valley, Texas · Serving businesses nationwide</p>
          </div>
          <div className="mx-auto w-full max-w-[256px] sm:max-w-[288px]"><Image src="/seraphcore-logo.webp" alt="SeraphCore silver S emblem with purple illumination" width={256} height={256} priority unoptimized className="h-auto w-full rounded-[18%] shadow-[0_0_60px_rgba(139,45,255,0.18)]" /></div>
        </div>
      </section>
      <section id="services" className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
        <p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">What we do</p><h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Built to solve real problems.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">{companyServices.map(({slug,title,description},i) => <article key={slug} className="rounded-3xl border border-white/10 bg-[#15111e] p-8"><span className="text-sm text-[#d1b47a]">0{i+1}</span><h3 className="mt-8 text-2xl font-semibold">{title}</h3><p className="mt-4 leading-7 text-[#c1b8cd]">{description}</p><Link href={"/services/"+slug} className="mt-6 inline-block text-sm font-semibold text-[#c5a4ff]">Explore service ↗</Link></article>)}</div>
      </section>
      <section id="work" className="border-y border-white/10 bg-[#120e1a]"><div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-12"><div><p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">Our technology</p><h2 className="mt-4 text-4xl font-semibold">More than a service provider.</h2><p className="mt-5 leading-7 text-[#c1b8cd]">We build our own software as well as solutions for clients. Explore SeraphNexus, our business operations and marketplace platform.</p><a href="/nexus" className="mt-7 inline-block rounded-full bg-[#c5a4ff] px-6 py-3 font-semibold text-[#170e24]">Explore SeraphNexus ↗</a></div><div className="rounded-3xl border border-white/10 bg-[#1a1425] p-8"><p className="text-sm tracking-widest text-[#c5a4ff]">SERAPH NEXUS</p><div className="mt-6 grid grid-cols-2 gap-3">{["Bookings","Commerce","Rentals","Business workspace"].map(x=><div key={x} className="rounded-xl border border-white/10 bg-[#251b33] p-5 text-sm">{x}</div>)}</div><p className="mt-6 text-sm text-[#c1b8cd]">Explore the existing platform and its public marketplace.</p><a href="/explore" className="mt-4 inline-block text-[#c5a4ff]">Visit marketplace →</a></div></div></section>
      <section id="about" className="mx-auto max-w-7xl px-6 py-20 lg:px-12"><p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">How we work</p><h2 className="mt-4 text-4xl font-semibold">Clear goals. Practical engineering.</h2><div className="mt-10 grid gap-6 md:grid-cols-3">{[["Discover","Understand your goals and current challenges."],["Design & build","Agree on scope, then create and test the solution."],["Launch & improve","Deliver the project and define ongoing support."]].map(([title,description],i)=><article key={title} className="border-t border-[#c5a4ff]/30 pt-6"><p className="text-[#d1b47a]">0{i+1}</p><h3 className="mt-3 text-xl font-semibold">{title}</h3><p className="mt-3 text-[#c1b8cd]">{description}</p></article>)}</div></section>
      <section className="mx-auto max-w-4xl px-6 pb-20"><h2 className="mb-8 text-3xl font-semibold">Frequently asked questions</h2>{questions.map(([question,answer])=><details key={question} className="border-t border-white/10 py-5"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 leading-7 text-[#c1b8cd]">{answer}</p></details>)}</section>
      <section id="contact" className="border-t border-white/10 bg-[#1a1127]"><div className="mx-auto max-w-4xl px-6 py-20"><p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">Start a conversation</p><h2 className="mt-4 text-4xl font-semibold sm:text-5xl">What would you like to improve?</h2><p className="mt-5 text-[#d1c7df]">Tell us about your business, goals and the solution you need.</p><Link href="/contact" className="mt-7 inline-block rounded-full bg-[#c5a4ff] px-7 py-4 font-semibold text-[#170e24]">Send a project inquiry ↗</Link></div></section>
    </div>
  );
}
