import DashboardSidebar from "@/components/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[#0b0f17] text-white">
      <aside className="w-64 border-r border-white/10 p-6">
        <DashboardSidebar />
      </aside>

      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}