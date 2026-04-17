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
    <div className="min-h-screen px-4 py-4 md:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {header}
        {controlBar}

        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            {sidebar}
          </aside>

          <main className="min-w-0 space-y-4">
            <section className="xl:hidden">{mobileSidebar}</section>
            {featured}
            {grid}
          </main>
        </div>
      </div>
    </div>
  );
}
