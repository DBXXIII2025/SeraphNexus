import Link from "next/link";
import { getPlatformSettings } from "@/lib/platformSettings";
import { resolvePlatformName } from "@/lib/platformBranding";

const capabilities = [
  { title: "Bookings & services", description: "Give customers a direct path to book services and manage requests." },
  { title: "Products & orders", description: "Bring your catalog, customer orders, and checkout into one place." },
  { title: "Rentals & availability", description: "Showcase rental offerings and help customers find the right fit." },
  { title: "Business workspace", description: "Keep customer activity, messages, promotions, and operations connected." },
];

export const metadata = {
  title: "Seraph Nexus | Discover businesses. Run yours.",
  description: "Explore local businesses or create your own storefront with bookings, rentals, products, orders, and customer management.",
};

export default async function HomePage() {
  const settings = await getPlatformSettings();
  const name = resolvePlatformName(settings);
  return (
    <div className="bg-[var(--page-bg)] text-[var(--text-main)]">
      <section className="relative overflow-hidden border-b border-[var(--border-soft)] bg-[var(--section-bg)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 h-96 w-96 rounded-full bg-[var(--accent-muted)] opacity-70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
              Welcome to {name}
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-[var(--text-strong)] sm:text-5xl lg:text-6xl">
              Discover great businesses. Build yours in one place.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-soft)]">
              Explore services, shops, and rentals with direct ways to take action.
              Running a business? Manage bookings, products, orders, and customer connections from one workspace.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/explore" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition hover:opacity-90">Explore businesses <span aria-hidden="true" className="ml-2">→</span></Link>
              <Link href="/onboarding/create-business" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-3 font-semibold text-[var(--text-strong)] transition hover:bg-[var(--accent-muted)]">Create your business</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">One connected platform</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">From discovery to action</h2>
            <div className="mt-7 grid gap-3">
              {["Find a business that fits your needs", "Book, shop, or explore rentals", "Manage your business in one workspace"].map((step, index) => (
                <div key={step} className="flex items-center gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-muted)] font-bold text-[var(--text-strong)]">{index + 1}</span>
                  <p className="font-medium text-[var(--text-strong)]">{step}</p>
                </div>
              ))}
            </div>
            <Link href="/pricing" className="mt-6 inline-flex font-semibold text-[var(--text-strong)] underline underline-offset-4">See business plans <span aria-hidden="true" className="ml-2">→</span></Link>
          </div>
        </div>
      </section>
      <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--text-soft)]">What you can do</p>
          <h2 id="features-heading" className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-strong)] sm:text-4xl">The tools behind your next step</h2>
          <p className="mt-4 text-[var(--text-soft)]">Whether you're looking for a business or building one, find a simpler way forward.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(({ title, description }) => (
            <article key={title} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <h3 className="text-lg font-semibold text-[var(--text-strong)]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="border-t border-[var(--border-soft)] bg-[var(--section-bg)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-2xl font-bold text-[var(--text-strong)]">Ready to get started?</h2><p className="mt-2 text-[var(--text-soft)]">Find businesses or bring your own online.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/explore" className="rounded-xl border border-[var(--border-strong)] px-5 py-3 font-semibold text-[var(--text-strong)]">Browse marketplace</Link><Link href="/signup" className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-contrast)]">Get started</Link></div>
        </div>
      </section>
    </div>
  );
}
