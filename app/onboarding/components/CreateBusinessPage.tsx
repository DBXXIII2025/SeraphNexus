import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platformAdmin";
import CreateBusinessForm from "./CreateBusinessForm";

export default async function CreateBusinessPage({
  redirectPath,
}: {
  redirectPath: string;
}) {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(redirectPath)}`);
  }

  if (isPlatformAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-main)]">
        <div className="w-full max-w-lg rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-semibold mb-2">Platform-owner account</h1>
          <p className="mb-6 text-sm text-[var(--text-soft)]">
            Business creation is disabled for the platform-owner account to keep platform operations separate from tenant workspaces and test businesses.
          </p>
          <Link
            href="/admin/platform"
            className="inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)]"
          >
            Open platform control
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-main)]">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-semibold mb-2">Create Your Business</h1>
        <p className="mb-6 text-sm text-[var(--text-soft)]">
          Set up your workspace to start taking bookings, orders, rentals, or sales.
        </p>
        <CreateBusinessForm />
      </div>
    </div>
  );
}
