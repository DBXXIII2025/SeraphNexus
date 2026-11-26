import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, House, LayoutGrid, ShoppingBag, Sparkles, Wind, MessageCircle } from "@/components/landing/LandingIcons";
import { getPlatformSettings } from "@/lib/platformSettings";
import { resolvePlatformName } from "@/lib/platformBranding";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seraph Nexus | Discover what moves you",
  description: "Discover services, rentals, shops and food. Build your business on one connected platform.",
};

export default async function HomePage() {
  const settings = await getPlatformSettings();
  const name = resolvePlatformName(settings);
  return (
    <div className="sn-home min-h-screen bg-[#0c0a12] text-[#f5f1fa]">
      <section className="sn-hero relative isolate overflow-hidden border-b border-[#352b43] px-5 pb-16 pt-20 sm:px-8 lg:pb-20 lg:pt-28">
        <div aria-hidden="true" className="sn-hero-orb absolute -left-28 top-8 h-80 w-80 rounded-full bg-[#392356] opacity-60 blur-3xl" />
        <div aria-hidden="true" className="sn-hero-orb absolute -right-20 top-12 h-96 w-96 rounded-full bg-[#302047] opacity-45 blur-3xl" />
        <div className="relative mx-auto max-w-6xl text-center">
          <p className="mb-7 text-[11px] font-bold uppercase tracking-[0.34em] text-[#d1b47a]">A simpler way forward</p>
          <h1 className="mx-auto max-w-5xl text-5xl font-semibold leading-[1.06] tracking-[-0.055em] text-[#f5f1fa] sm:text-7xl lg:text-[5.7rem]">
            Discover Great Businesses <span className="text-[#c5a4ff]">|</span><br className="hidden sm:block" /> Build Yours In One Place
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-[#c1b8cd] sm:text-lg">
            Discover local services, distinctive shops, and places to stay. Or bring your own business to life with {name}.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/explore" className="sn-pill inline-flex min-h-12 items-center gap-4 rounded-full bg-[#c5a4ff] px-7 py-3 text-sm font-semibold text-[#170e24] transition hover:bg-[#ddc8ff]">Explore the marketplace <ArrowUpRight size={17} aria-hidden="true" /></Link>
            <Link href="/onboarding/create-business" className="sn-pill inline-flex min-h-12 items-center gap-4 rounded-full border border-[#4a3b60] bg-[#15111e] px-7 py-3 text-sm font-semibold text-[#f5f1fa] transition hover:bg-[#15111e]">Build your business <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="discover-title" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d1b47a]">Everyday possibilities</p>
            <h2 id="discover-title" className="mt-2 text-3xl font-semibold tracking-tight text-[#f5f1fa] sm:text-4xl">Find your next favorite.</h2>
          </div>
          <Link href="/explore" className="inline-flex items-center gap-2 text-sm font-semibold text-[#c5a4ff] hover:underline">View marketplace <ArrowUpRight size={16} /></Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/explore?category=services" className="sn-feature-card sn-card-service group flex min-h-72 flex-col justify-between rounded-[1.6rem] border border-[#352b43] p-6 transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d1b47a]">Everyday expertise</span><Wind size={23} className="text-[#c5a4ff]" /></div>
            <div><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#15111e] text-[#c5a4ff]"><CalendarDays size={29} /></span><h3 className="text-2xl font-semibold tracking-tight">Services that fit.</h3><p className="mt-2 text-sm text-[#c1b8cd]">The right help, right when you need it.</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">Explore services <ArrowUpRight size={15} /></span></div>
          </Link>
          <Link href="/explore?category=rentals" className="sn-feature-card sn-card-rental group flex min-h-72 flex-col justify-between rounded-[1.6rem] border border-[#352b43] p-6 transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d1b47a]">Stays & getaways</span><House size={22} /></div>
            <div><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#15111e] text-[#c5a4ff]"><Compass size={30} /></span><h3 className="text-2xl font-semibold tracking-tight">A change of scenery.</h3><p className="mt-2 text-sm text-[#c1b8cd]">Find somewhere worth staying.</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">Explore rentals <ArrowUpRight size={15} /></span></div>
          </Link>
          <Link href="/explore?category=shops" className="sn-feature-card sn-card-shop group flex min-h-72 flex-col justify-between rounded-[1.6rem] border border-[#352b43] p-6 text-[#f5f1fa] transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d1b47a]">Independent finds</span><ShoppingBag size={22} /></div>
            <div><Sparkles size={34} className="mb-5 text-[#c5a4ff]" /><h3 className="text-3xl font-semibold tracking-tight">Made <span className="italic text-[#c5a4ff]">for you.</span></h3><p className="mt-2 text-sm text-[#c1b8cd]">A little more personal.</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">Explore shops <ArrowUpRight size={15} /></span></div>
          </Link>
          <Link href="/onboarding/create-business" className="sn-feature-card sn-card-business group flex min-h-72 flex-col justify-between rounded-[1.6rem] border border-[#4a3b60] p-6 transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d1b47a]">Built for your business</span><LayoutGrid size={22} /></div>
            <div><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#170e24] text-[#c5a4ff]"><LayoutGrid size={30} /></span><h3 className="text-2xl font-semibold tracking-tight">Less juggling. More doing.</h3><p className="mt-2 text-sm text-[#c1b8cd]">One connected workspace to grow your business.</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">Get started <ArrowUpRight size={15} /></span></div>
          </Link>
        </div>
      </section>

      <section id="features" className="border-t border-[#352b43] bg-[#15111e] px-5 py-16 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#d1b47a]">One connected platform</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything your business needs to move forward.</h2><p className="mt-4 max-w-xl text-[#c1b8cd]">Bookings, products, rentals, customer connections and day-to-day operations—together in one place.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-72"><div className="rounded-2xl border border-[#352b43] bg-[#15111e] p-5"><CalendarDays className="mb-3 text-[#c5a4ff]" /><span className="block text-sm font-semibold">Bookings</span></div><div className="rounded-2xl border border-[#352b43] bg-[#15111e] p-5"><ShoppingBag className="mb-3 text-[#c5a4ff]" /><span className="block text-sm font-semibold">Orders</span></div><div className="rounded-2xl border border-[#352b43] bg-[#15111e] p-5"><MessageCircle className="mb-3 text-[#c5a4ff]" /><span className="block text-sm font-semibold">Customers</span></div><div className="rounded-2xl border border-[#352b43] bg-[#15111e] p-5"><LayoutGrid className="mb-3 text-[#c5a4ff]" /><span className="block text-sm font-semibold">Workspace</span></div></div>
        </div>
      </section>
    </div>
  );
}
