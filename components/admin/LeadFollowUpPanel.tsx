"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LEAD_STATUS_VALUES,
  type LeadBreakdownItem,
  type LeadSourceType,
  type LeadVisitorSummary,
} from "@/lib/leads";
import {
  formatAdminStatusLabel,
  getAdminActionButtonClass,
  getAdminStatusBadgeClass,
} from "@/lib/adminStatus";

type Props = {
  businessId: string;
  visitors: LeadVisitorSummary[];
  topSources: LeadBreakdownItem[];
  topPages: LeadBreakdownItem[];
  statusBreakdown: LeadBreakdownItem[];
  sourceTypeBreakdown: LeadBreakdownItem[];
};

type SaveState = {
  status: string;
  notes: string;
  lastContactedAt: string;
  saving: boolean;
  error: string | null;
  success: string | null;
};

type FollowUpFilter =
  | "all"
  | "needs_follow_up"
  | "new"
  | "uncontacted"
  | "recent"
  | "high_priority"
  | "contacted";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function hoursSince(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((Date.now() - new Date(value).getTime()) / 3600000);
}

function getPriorityClasses(priority: LeadVisitorSummary["priority"]) {
  switch (priority) {
    case "urgent":
      return "border-[var(--destructive-border)] bg-[var(--destructive-bg)] text-[var(--accent-soft)]";
    case "high":
      return "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent-soft)]";
    default:
      return "border-[var(--border-soft)] bg-[var(--surface-raised)] text-[var(--text-soft)]";
  }
}

function BreakdownList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: LeadBreakdownItem[];
  emptyLabel: string;
}) {
  return (
    <div className="surface-card p-5">
      <p className="section-kicker">{title}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-soft)]">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-3"
            >
              <p className="truncate text-sm text-[var(--text-strong)]">{item.label}</p>
              <span className="text-sm font-medium text-[var(--text-soft)]">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSourceTypeLabel(sourceType: LeadSourceType) {
  return sourceType.replace("_", " ");
}

export default function LeadFollowUpPanel({
  businessId,
  visitors,
  topSources,
  topPages,
  statusBreakdown,
  sourceTypeBreakdown,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("needs_follow_up");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSourceType | "all">("all");
  const [saveState, setSaveState] = useState<Record<string, SaveState>>(() =>
    Object.fromEntries(
      visitors.map((visitor) => [
        visitor.latestEventId,
        {
          status: visitor.latestStatus || "new",
          notes: visitor.latestNotes || "",
          lastContactedAt: toDatetimeLocalValue(visitor.lastContactedAt),
          saving: false,
          error: null,
          success: null,
        },
      ])
    )
  );

  function updateLocalState(id: string, patch: Partial<SaveState>) {
    setSaveState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  async function saveLead(id: string) {
    const state = saveState[id];
    if (!state) {
      return;
    }

    updateLocalState(id, { saving: true, error: null, success: null });

    const payload = {
      id,
      status: state.status,
      notes: state.notes,
      last_contacted_at: state.lastContactedAt || null,
    };

    try {
      const response = await fetch("/api/leads/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to update lead");
      }

      updateLocalState(id, {
        saving: false,
        error: null,
        success: "Lead follow-up saved.",
      });
      router.refresh();
    } catch (error) {
      updateLocalState(id, {
        saving: false,
        error: error instanceof Error ? error.message : "Failed to update lead",
        success: null,
      });
    }
  }

  function markContacted(id: string) {
    const now = toDatetimeLocalValue(new Date().toISOString());
    updateLocalState(id, {
      status: "contacted",
      lastContactedAt: now,
      error: null,
      success: null,
    });
  }

  const filteredVisitors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return visitors.filter((visitor) => {
      if (statusFilter !== "all" && (visitor.latestStatus || "new") !== statusFilter) {
        return false;
      }

      if (sourceFilter !== "all" && visitor.sourceType !== sourceFilter) {
        return false;
      }

      if (followUpFilter === "needs_follow_up" && !visitor.needsFollowUp) {
        return false;
      }

      if (followUpFilter === "new" && (visitor.latestStatus || "new") !== "new") {
        return false;
      }

      if (followUpFilter === "uncontacted" && !visitor.uncontacted) {
        return false;
      }

      if (followUpFilter === "recent" && hoursSince(visitor.lastSeenAt) > 48) {
        return false;
      }

      if (followUpFilter === "high_priority" && visitor.priority !== "urgent") {
        return false;
      }

      if (followUpFilter === "contacted" && visitor.uncontacted) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        visitor.displayName,
        visitor.visitorEmail,
        visitor.visitorPhone,
        visitor.contextLabel,
        visitor.summary,
        visitor.latestSource,
        visitor.latestNotes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [followUpFilter, query, sourceFilter, statusFilter, visitors]);

  const visibleNeedsFollowUp = filteredVisitors.filter((visitor) => visitor.needsFollowUp).length;
  const visibleUncontacted = filteredVisitors.filter((visitor) => visitor.uncontacted).length;
  const visibleUrgent = filteredVisitors.filter((visitor) => visitor.priority === "urgent").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <BreakdownList
          title="Top Sources"
          items={topSources}
          emptyLabel="No source data available yet."
        />
        <BreakdownList
          title="Lead Statuses"
          items={statusBreakdown}
          emptyLabel="No lead statuses have been recorded yet."
        />
        <BreakdownList
          title="Lead Types"
          items={sourceTypeBreakdown}
          emptyLabel="No lead type data available yet."
        />
      </div>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Follow-Up</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Lead command center
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              Focus on fresh demand, neglected follow-up, and leads with direct conversation,
              booking, reservation, or checkout intent.
            </p>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--destructive-border)] bg-[var(--destructive-bg)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Needs Follow-Up
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--accent-soft)]">
                {visibleNeedsFollowUp}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Uncontacted
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--accent-soft)]">
                {visibleUncontacted}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Urgent
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                {visibleUrgent}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.45fr,0.95fr]">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-soft)]">Search</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, email, phone, context"
                  className="input-field"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-soft)]">Follow-up filter</span>
                <select
                  value={followUpFilter}
                  onChange={(event) => setFollowUpFilter(event.target.value as FollowUpFilter)}
                  className="input-field"
                >
                  <option value="all">All leads</option>
                  <option value="needs_follow_up">Needs follow-up</option>
                  <option value="new">New</option>
                  <option value="uncontacted">Uncontacted</option>
                  <option value="recent">Recent</option>
                  <option value="high_priority">Urgent</option>
                  <option value="contacted">Contacted</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-soft)]">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="input-field"
                >
                  <option value="all">All statuses</option>
                  {LEAD_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-soft)]">Lead type</span>
                <select
                  value={sourceFilter}
                  onChange={(event) =>
                    setSourceFilter(event.target.value as LeadSourceType | "all")
                  }
                  className="input-field"
                >
                  <option value="all">All types</option>
                  <option value="message">Message</option>
                  <option value="booking">Booking</option>
                  <option value="reservation">Reservation</option>
                  <option value="checkout">Checkout</option>
                  <option value="page_view">Page view</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Signal Snapshot
            </p>
            <div className="mt-3 space-y-3 text-sm text-[var(--text-soft)]">
              <p>{filteredVisitors.length} leads match the current filters.</p>
              <p>{topPages.length > 0 ? `Top page: ${topPages[0].label}` : "No page signal yet."}</p>
              <p>
                {topSources.length > 0
                  ? `Top source: ${topSources[0].label}`
                  : "No referral or source signal yet."}
              </p>
              <p>
                Active business scope: <span className="text-[var(--text-strong)]">{businessId}</span>
              </p>
            </div>
          </div>
        </div>

        {visitors.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
            Visitor grouping will appear once this business captures page views, direct message
            intent, guest messages, or checkout starts.
          </div>
        ) : filteredVisitors.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-8 text-sm text-[var(--text-soft)]">
            No leads match the current filters. Clear or broaden the filters to restore the queue.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {filteredVisitors.map((visitor) => {
              const state = saveState[visitor.latestEventId];

              return (
                <div
                  key={visitor.key}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--text-strong)]">
                          {visitor.displayName}
                        </h3>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em] ${getPriorityClasses(
                            visitor.priority
                          )}`}
                        >
                          {visitor.priority}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getAdminStatusBadgeClass(
                            visitor.latestStatus || "new"
                          )}`}
                        >
                          {formatAdminStatusLabel(visitor.latestStatus, "New")}
                        </span>
                        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs capitalize text-[var(--text-soft)]">
                          {formatSourceTypeLabel(visitor.sourceType)}
                        </span>
                      </div>

                      <p className="text-sm text-[var(--text-strong)]">{visitor.contextLabel}</p>
                      <p className="text-sm text-[var(--text-soft)]">{visitor.summary}</p>

                      <div className="space-y-1 text-sm text-[var(--text-soft)]">
                        {visitor.visitorEmail ? <p>{visitor.visitorEmail}</p> : null}
                        {visitor.visitorPhone ? <p>{visitor.visitorPhone}</p> : null}
                        {visitor.latestSource ? <p>Source: {visitor.latestSource}</p> : null}
                      </div>
                    </div>

                    <div className="min-w-[220px] space-y-1 text-right text-sm text-[var(--text-soft)]">
                      <p>First seen {formatDateTime(visitor.firstSeenAt)}</p>
                      <p>Last seen {formatDateTime(visitor.lastSeenAt)}</p>
                      {visitor.lastContactedAt ? (
                        <p>Last contacted {formatDateTime(visitor.lastContactedAt)}</p>
                      ) : (
                        <p>Not contacted yet</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Events</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{visitor.totalEvents}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Messages</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--accent-soft)]">{visitor.messagesSent}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Message Clicks</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{visitor.messageClicks}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Bookings</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--accent-soft)]">{visitor.bookingStarts}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Checkouts</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--accent-soft)]">{visitor.checkoutStarts}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Views</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{visitor.pageViews}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm">
                          <span className="text-[var(--text-soft)]">Lead status</span>
                          <select
                            value={state?.status || "new"}
                            onChange={(event) =>
                              updateLocalState(visitor.latestEventId, {
                                status: event.target.value,
                                error: null,
                                success: null,
                              })
                            }
                            className="input-field"
                          >
                            {LEAD_STATUS_VALUES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2 text-sm">
                          <span className="text-[var(--text-soft)]">Last contacted</span>
                          <input
                            type="datetime-local"
                            value={state?.lastContactedAt || ""}
                            onChange={(event) =>
                              updateLocalState(visitor.latestEventId, {
                                lastContactedAt: event.target.value,
                                error: null,
                                success: null,
                              })
                            }
                            className="input-field"
                          />
                        </label>
                      </div>

                      <label className="mt-4 block space-y-2 text-sm">
                        <span className="text-[var(--text-soft)]">Follow-up notes</span>
                        <textarea
                          value={state?.notes || ""}
                          onChange={(event) =>
                            updateLocalState(visitor.latestEventId, {
                              notes: event.target.value,
                              error: null,
                              success: null,
                            })
                          }
                          rows={4}
                          placeholder="Record what happened, next step, or a callback time."
                          className="input-field min-h-[132px]"
                        />
                      </label>

                      {state?.error ? (
                        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                          {state.error}
                        </div>
                      ) : null}

                      {state?.success ? (
                        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                          {state.success}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        Quick actions
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {visitor.primaryActionHref && visitor.primaryActionLabel ? (
                          <Link
                            href={visitor.primaryActionHref}
                          className={getAdminActionButtonClass("secondary")}
                        >
                          {visitor.primaryActionLabel}
                        </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => markContacted(visitor.latestEventId)}
                          className={getAdminActionButtonClass("neutral")}
                        >
                          Mark Contacted
                        </button>
                        <button
                          type="button"
                          onClick={() => saveLead(visitor.latestEventId)}
                          disabled={state?.saving}
                          className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {state?.saving ? "Saving..." : "Save Follow-Up"}
                        </button>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-[var(--text-soft)]">
                        <p>
                          Top pages:{" "}
                          {visitor.topPages.length > 0
                            ? visitor.topPages.map((item) => item.label).join(", ")
                            : "No page path captured"}
                        </p>
                        <p>
                          Top sources:{" "}
                          {visitor.topSources.length > 0
                            ? visitor.topSources.map((item) => item.label).join(", ")
                            : "No source captured"}
                        </p>
                        <p>Latest event id: {visitor.latestEventId}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
