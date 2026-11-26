import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "SeraphCore Technologies | AI, Software & Web Development" },
  description: "SeraphCore builds business websites, custom software, AI automation and digital growth solutions in the Rio Grande Valley and across the United States.",
  alternates: { canonical: "/" },
  openGraph: { title: "SeraphCore Technologies", description: "Technology built around your business.", siteName: "SeraphCore Technologies", type: "website", url: "/" },
  twitter: { card: "summary", title: "SeraphCore Technologies", description: "AI, software and web development for businesses." },
};

const services = [
  ["01", "AI engineering", "Customer assistants, workflow automation and AI integrations designed around your actual operations."],
  ["02", "Software engineering", "Custom business applications, dashboards and connected systems that reduce repetitive work."],
  ["03", "Web development", "Fast, responsive websites designed to make it easier for customers to discover and contact you."],
  ["04", "Digital growth", "Technical SEO, answer engine optimization, analytics and social media strategy."],
];
const questions = [
  ["Who do you work with?", "Small and growing businesses in the Rio Grande Valley and across the United States."],
  ["Can you improve an existing website?", "Yes. We can assess your existing website and recommend targeted improvements or a rebuild based on your goals."],
  ["How much does a project cost?", "Pricing depends on scope, integrations and ongoing support. We agree on deliverables and pricing before development begins."],
  ["Do you offer ongoing support?", "Maintenance and ongoing improvements can be included in a separate support agreement."],
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0c0a12] text-[#f5f1fa]">
      <header className="border-b border-white/10">
        <nav aria-label="SeraphCore navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-6 lg:px-12">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl border border-[#b99be8]/40 bg-[#221532] text-xl text-[#d5b7ff]">✧</span>
            <span className="font-semibold tracking-[.15em]">SERAPHCORE<span className="block text-[9px] tracking-[.35em] text-[#c7a66b]">TECHNOLOGIES</span></span>
          </Link>
          <div className="flex flex-wrap items-center gap-5 text-sm text-[#d1c7df]">
            <a href="#services">Services</a><a href="#work">Products</a><a href="#about">About</a><Link href="/nexus">Nexus</Link>
            <a href="#contact" className="rounded-full border border-[#b99be8]/50 px-4 py-2 text-white">Start a project</a>
          </div>
        </nav>
      </header>
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_35%,#362052_0%,transparent_55%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-[1.25fr_1fr] lg:px-12 lg:py-32">
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[.28em] text-[#d1b47a]">Intelligence · Engineering · Growth</p>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">Technology built around <span className="text-[#c5a4ff]">your business.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#c1b8cd]">From a better website to intelligent automation, we engineer practical digital solutions that help businesses win customers and simplify operations.</p>
            <div className="mt-9 flex flex-wrap gap-3"><a href="#contact" className="rounded-full bg-[#c5a4ff] px-7 py-4 font-semibold text-[#170e24]">Plan your project ↗</a><a href="#work" className="rounded-full border border-white/20 px-7 py-4 font-semibold">Explore our work</a></div>
            <p className="mt-8 text-sm text-[#b7acc6]">Based in the Rio Grande Valley, Texas · Serving businesses nationwide</p>
          </div>
          <div aria-hidden="true" className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center rounded-full border border-[#c5a4ff]/20">
            <div className="absolute inset-[10%] rotate-45 rounded-[25%] border border-[#c5a4ff]/30"/><div className="absolute inset-[20%] rounded-full border border-[#c7a66b]/40"/><div className="absolute inset-[28%] rotate-45 rounded-2xl border border-[#c5a4ff]/50 bg-[#251539]/80"/><span className="relative text-8xl text-[#dcc4ff]">✧</span>
          </div>
        </div>
      </section>
      <section id="services" className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
        <p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">What we do</p><h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Built to solve real problems.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">{services.map(([number,title,description]) => <article key={number} className="rounded-3xl border border-white/10 bg-[#15111e] p-8"><span className="text-sm text-[#d1b47a]">{number}</span><h3 className="mt-8 text-2xl font-semibold">{title}</h3><p className="mt-4 leading-7 text-[#c1b8cd]">{description}</p><a href="#contact" className="mt-6 inline-block text-sm font-semibold text-[#c5a4ff]">Discuss your needs ↗</a></article>)}</div>
      </section>
      <section id="work" className="border-y border-white/10 bg-[#120e1a]"><div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-12"><div><p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">Our technology</p><h2 className="mt-4 text-4xl font-semibold">More than a service provider.</h2><p className="mt-5 leading-7 text-[#c1b8cd]">We build our own software as well as solutions for clients. Explore SeraphNexus, our business operations and marketplace platform.</p><Link href="/nexus" className="mt-7 inline-block rounded-full bg-[#c5a4ff] px-6 py-3 font-semibold text-[#170e24]">Explore SeraphNexus ↗</Link></div><div className="rounded-3xl border border-white/10 bg-[#1a1425] p-8"><p className="text-sm tracking-widest text-[#c5a4ff]">SERAPH NEXUS</p><div className="mt-6 grid grid-cols-2 gap-3">{["Bookings","Commerce","Rentals","Business workspace"].map(x=><div key={x} className="rounded-xl border border-white/10 bg-[#251b33] p-5 text-sm">{x}</div>)}</div><p className="mt-6 text-sm text-[#c1b8cd]">Explore the existing platform and its public marketplace.</p><Link href="/explore" className="mt-4 inline-block text-[#c5a4ff]">Visit marketplace →</Link></div></div></section>
      <section id="about" className="mx-auto max-w-7xl px-6 py-20 lg:px-12"><p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">How we work</p><h2 className="mt-4 text-4xl font-semibold">Clear goals. Practical engineering.</h2><div className="mt-10 grid gap-6 md:grid-cols-3">{[["Discover","Understand your goals and current challenges."],["Design & build","Agree on scope, then create and test the solution."],["Launch & improve","Deliver the project and define ongoing support."]].map(([title,description],i)=><article key={title} className="border-t border-[#c5a4ff]/30 pt-6"><p className="text-[#d1b47a]">0{i+1}</p><h3 className="mt-3 text-xl font-semibold">{title}</h3><p className="mt-3 text-[#c1b8cd]">{description}</p></article>)}</div></section>
      <section className="mx-auto max-w-4xl px-6 pb-20"><h2 className="mb-8 text-3xl font-semibold">Frequently asked questions</h2>{questions.map(([question,answer])=><details key={question} className="border-t border-white/10 py-5"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 leading-7 text-[#c1b8cd]">{answer}</p></details>)}</section>
      <section id="contact" className="border-t border-white/10 bg-[#1a1127]"><div className="mx-auto max-w-4xl px-6 py-20"><p className="text-xs uppercase tracking-[.25em] text-[#d1b47a]">Start a conversation</p><h2 className="mt-4 text-4xl font-semibold sm:text-5xl">What would you like to improve?</h2><p className="mt-5 text-[#d1c7df]">Prepare a project brief to share with our team. Tell us about your business, goals and the solution you need.</p><Link href="/project-brief" className="mt-7 inline-block rounded-full bg-[#c5a4ff] px-7 py-4 font-semibold text-[#170e24]">Prepare a project brief ↗</Link></div></section>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-5 px-6 py-8 text-sm text-[#b7acc6] lg:px-12"><span>© 2026 SeraphCore Technologies</span><div className="flex flex-wrap gap-5"><Link href="/nexus">SeraphNexus</Link><Link href="/explore">Marketplace</Link><Link href="/login">Platform sign in</Link></div></footer>
    </div>
  );
}
