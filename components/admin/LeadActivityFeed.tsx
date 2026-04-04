import Link from "next/link";
import type { LeadRecentActivityItem } from "@/lib/leads";
import { formatAdminStatusLabel, getAdminStatusBadgeClass } from "@/lib/adminStatus";

type Props = {
  items: LeadRecentActivityItem[];
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getEventTone(eventType: string) {
  if (eventType === "checkout_started" || eventType === "booking_started") {
    return "border-[rgba(193,18,31,0.22)]";
  }

  if (eventType === "message_sent" || eventType === "message_click") {
    return "border-[rgba(212,175,55,0.18)]";
  }

  return "border-[var(--border-soft)]";
}

export default function LeadActivityFeed({ items }: Props) {
  return (
    <section className="surface-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Recent Activity</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            Fresh lead signals
          </h2>
        </div>
        <p className="text-sm text-[var(--text-soft)]">{items.length} events visible</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(15,12,12,0.72)] px-4 py-8 text-sm text-[var(--text-soft)]">
          No lead activity has been captured for this business yet.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border bg-[rgba(15,12,12,0.52)] p-5 shadow-[0_16px_30px_rgba(0,0,0,0.24)] ${getEventTone(
                item.eventType
              )}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--text-strong)]">{item.label}</p>
                    <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(31,25,25,0.88)] px-2.5 py-1 text-xs font-medium capitalize text-[var(--text-soft)]">
                      {item.sourceType.replace("_", " ")}
                    </span>
                    {item.status ? (
                        <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getAdminStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        {formatAdminStatusLabel(item.status, "New")}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm text-[var(--text-soft)]">
                    {item.visitorName || item.visitorEmail || item.visitorPhone || "Anonymous visitor"}
                  </p>
                  <p className="text-sm text-[var(--text-strong)]">{item.contextLabel}</p>

                  {item.details.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.details.map((detail) => (
                        <span
                          key={detail}
                          className="rounded-full border border-[var(--border-soft)] bg-[rgba(31,25,25,0.88)] px-2.5 py-1 text-xs text-[var(--text-soft)]"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {item.notes ? (
                    <p className="pt-1 text-sm leading-6 text-[var(--text-soft)]">{item.notes}</p>
                  ) : null}
                </div>

                <div className="min-w-[220px] space-y-2 text-right text-sm text-[var(--text-soft)]">
                  <p>{formatDateTime(item.occurredAt)}</p>
                  {item.lastContactedAt ? (
                    <p>Last contacted {formatDateTime(item.lastContactedAt)}</p>
                  ) : (
                    <p>Not contacted yet</p>
                  )}
                  {item.actionHref && item.actionLabel ? (
                    <Link
                      href={item.actionHref}
                      className="inline-flex rounded-full border border-[var(--border-soft)] bg-[rgba(31,25,25,0.88)] px-3 py-1 text-xs font-medium text-[var(--text-strong)] transition hover:border-[rgba(212,175,55,0.2)] hover:bg-[rgba(36,29,29,0.98)]"
                    >
                      {item.actionLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
