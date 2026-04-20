import DashboardSidebar from "@/components/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
      <aside className="w-64 border-r border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <DashboardSidebar />
      </aside>

      <main className="flex-1 bg-[var(--page-bg)] p-8">
        {children}
      </main>
    </div>
  );
}
