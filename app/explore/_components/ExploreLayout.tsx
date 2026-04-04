"use client";

export default function ExploreLayout({
  header,
  controlBar,
  sidebar,
  mobileSidebar,
  featured,
  grid,
}: {
  header: React.ReactNode;
  controlBar: React.ReactNode;
  sidebar: React.ReactNode;
  mobileSidebar: React.ReactNode;
  featured: React.ReactNode;
  grid: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6 md:px-8 lg:py-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {header}
        {controlBar}

        <div className="grid gap-6 xl:grid-cols-[304px_minmax(0,1fr)] xl:gap-8">
          <aside className="hidden xl:block">
            <div className="sticky top-24">{sidebar}</div>
          </aside>

          <main className="min-w-0 space-y-6">
            <section className="xl:hidden">{mobileSidebar}</section>
            {featured}
            {grid}
          </main>
        </div>
      </div>
    </div>
  );
}
