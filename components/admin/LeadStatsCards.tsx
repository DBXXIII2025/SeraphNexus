import type { LeadSummaryMetrics } from "@/lib/leads";
import { DashboardGrid, MetricCard } from "@/components/admin/AdminLayoutSystem";

type Props = {
  summary: LeadSummaryMetrics;
};

const STAT_ITEMS: Array<{
  key: keyof LeadSummaryMetrics;
  label: string;
  detail: string;
  accent: "priority" | "highlight" | "neutral";
}> = [
  {
    key: "needsFollowUpLeads",
    label: "Needs Follow-Up",
    detail: "Open leads that still need direct owner action.",
    accent: "priority",
  },
  {
    key: "highPriorityLeads",
    label: "High Priority",
    detail: "Leads showing strong buying or booking intent.",
    accent: "highlight",
  },
  {
    key: "uncontactedLeads",
    label: "Uncontacted",
    detail: "Leads without a recorded follow-up touch yet.",
    accent: "priority",
  },
  {
    key: "newLeads",
    label: "New Leads",
    detail: "Grouped leads still sitting in the new state.",
    accent: "neutral",
  },
  {
    key: "recentLeads",
    label: "Recent",
    detail: "Leads active within the last 48 hours.",
    accent: "highlight",
  },
  {
    key: "totalGroupedLeads",
    label: "Total Leads",
    detail: "Distinct lead records grouped from real visitor signals.",
    accent: "neutral",
  },
];

export default function LeadStatsCards({ summary }: Props) {
  return (
    <DashboardGrid className="sm:grid-cols-2 xl:grid-cols-3">
      {STAT_ITEMS.map((item) => {
        const value = summary[item.key];
        const accentClass =
          item.accent === "priority"
            ? "text-[var(--accent)]"
            : item.accent === "highlight"
              ? "text-[var(--accent-soft)]"
              : "text-[var(--text-strong)]";

        return (
          <MetricCard key={item.key}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">{item.label}</p>
                <p className={`mt-5 text-4xl font-semibold ${accentClass}`}>{value}</p>
              </div>
              <div className="status-chip">Live</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{item.detail}</p>
          </MetricCard>
        );
      })}
    </DashboardGrid>
  );
}
