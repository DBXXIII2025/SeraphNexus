import Link from "next/link";
import { EmptyState } from "@/components/ui/app-ui";

export default function NotFound() {
  return (
    <div className="public-system flex min-h-screen items-center justify-center px-4 py-10 text-[var(--text-main)]">
      <div className="w-full max-w-xl">
        <EmptyState
          title="Page not found"
          description="This Seraph Nexus page may have moved, expired, or is not available to your account."
          action={
            <div className="flex flex-wrap gap-3">
              <Link href="/explore" className="btn-primary px-4 py-2 text-sm font-medium">
                Explore businesses
              </Link>
              <Link href="/login" className="btn-secondary px-4 py-2 text-sm font-medium">
                Sign in
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
