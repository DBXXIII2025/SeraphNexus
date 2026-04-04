"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PublicRouteRedirect({
  href,
  businessName,
}: {
  href: string;
  businessName: string;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
          Opening {businessName}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Redirecting to the correct public page for this business.
        </p>
        <div className="mt-6">
          <Link
            href={href}
            className="inline-flex rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--panel-strong)]"
          >
            Continue
          </Link>
        </div>
      </div>
    </div>
  );
}
