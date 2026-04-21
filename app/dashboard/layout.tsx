import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebar from "@/components/DashboardSidebar";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
      <aside className="w-64 border-r border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <DashboardSidebar />
      </aside>

      <main className="flex-1 bg-[var(--page-bg)] p-8">
        <div className="mb-6 flex items-center justify-end gap-3">
          {user?.id ? <AdminNotificationBell userId={user.id} /> : null}
          <Link href="/admin" className="btn-secondary px-4 py-2 text-sm font-medium">
            Open Admin
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
