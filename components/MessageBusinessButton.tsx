"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackLeadEvent } from "@/lib/leadTracker";

export default function MessageBusinessButton({
  businessId,
  className,
}: {
  businessId: string;
  className?: string;
}) {
  const pathname = usePathname();
  const source = pathname || "/";
  const href = `/messages?businessId=${encodeURIComponent(businessId)}&source=${encodeURIComponent(source)}`;

  return (
    <Link
      href={href}
      onClick={() => {
        void trackLeadEvent({
          businessId,
          eventType: "message_click",
          source,
        }).catch((error) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("[message-business] lead tracking failed:", error);
          }
        });

        if (process.env.NODE_ENV !== "production") {
          console.log("[message-business] button clicked", {
            businessId,
            source,
            href,
          });
        }
      }}
      className={
        className ||
        "inline-flex items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--panel-strong)]"
      }
    >
      Message Business
    </Link>
  );
}
