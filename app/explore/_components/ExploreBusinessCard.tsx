"use client";

import Link from "next/link";
import { BusinessViewModel, formatBusinessType, getCategoryMeta } from "../exploreData";
import StructuredIcon from "@/components/icons/StructuredIcon";

export default function ExploreBusinessCard({
  business,
  featured = false,
}: {
  business: BusinessViewModel;
  featured?: boolean;
}) {
  const category = getCategoryMeta(business.categoryId);

  return (
    <article className="group relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[var(--shadow-strong)]">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${category.tone}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-soft)]">
            {business.initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-soft)]">
                {category.shortLabel}
              </span>
              {featured ? (
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--accent-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  Featured
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 truncate text-[15px] font-semibold text-[var(--text-strong)]">
              {business.displayName}
            </h3>
            <p className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <StructuredIcon name={business.iconName} className="h-4 w-4 text-[var(--accent-soft)]" />
              {formatBusinessType(business.business_type)}
            </p>
          </div>
        </div>

        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-strong)]">
          {business.routeLabel}
        </span>
      </div>

      <div className="mt-4 rounded-[1.1rem] border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Customer path</p>
        <p className="mt-2 text-sm font-medium text-[var(--text-strong)]">{business.routeSummary}</p>
      </div>

      <p className="mt-4 flex-1 text-sm leading-6 text-[var(--text-soft)]">
        {business.displayDescription}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {business.routeState.isRoutable ? "Public-ready" : "Needs route fix"}
        </span>
        {business.routeState.isRoutable ? (
          <Link
            href={business.routeState.href}
            className="btn-primary inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm font-semibold"
          >
            {business.routeLabel}
          </Link>
        ) : (
          <span className="btn-secondary inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm font-medium text-[var(--text-soft)]">
            Unavailable
          </span>
        )}
      </div>
    </article>
  );
}
