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
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-zinc-900/70 border border-white/10 rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-semibold mb-2">Platform-owner account</h1>
          <p className="text-sm text-gray-400 mb-6">
            Business creation is disabled for the platform-owner account to keep platform operations separate from tenant workspaces and test businesses.
          </p>
          <Link
            href="/admin/platform"
            className="inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
          >
            Open platform control
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-zinc-900/70 border border-white/10 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-semibold mb-2">Create Your Business</h1>
        <p className="text-sm text-gray-400 mb-6">
          Set up your workspace to start taking bookings, orders, rentals, or sales.
        </p>
        <CreateBusinessForm />
      </div>
    </div>
  );
}
