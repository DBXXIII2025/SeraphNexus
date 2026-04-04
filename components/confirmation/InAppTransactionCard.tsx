"use client";

import Link from "next/link";

export type InAppTransactionItem = {
  label: string;
  value: string;
};

export type InAppTransactionSection = {
  title: string;
  items: InAppTransactionItem[];
};

function getBadgeClass(tone: "confirmed" | "pending" | "attention") {
  if (tone === "confirmed") {
    return "border-[rgba(212,175,55,0.26)] bg-[rgba(212,175,55,0.12)] text-[var(--accent-gold-soft)]";
  }

  if (tone === "pending") {
    return "border-[rgba(184,176,170,0.2)] bg-[rgba(184,176,170,0.08)] text-[var(--text-soft)]";
  }

  return "border-[rgba(193,18,31,0.3)] bg-[rgba(193,18,31,0.12)] text-[#f1a0a7]";
}

export default function InAppTransactionCard({
  badge,
  tone,
  title,
  subtitle,
  amount,
  meta,
  sections,
  href,
  hrefLabel,
}: {
  badge: string;
  tone: "confirmed" | "pending" | "attention";
  title: string;
  subtitle: string;
  amount?: string | null;
  meta?: string | null;
  sections: InAppTransactionSection[];
  href?: string | null;
  hrefLabel?: string | null;
}) {
  return (
    <article className="premium-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.2em] ${getBadgeClass(
              tone
            )}`}
          >
            {badge}
          </span>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text-strong)]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
            {subtitle}
          </p>
        </div>

        {amount || meta ? (
          <div className="min-w-[180px] rounded-2xl border border-[var(--border-soft)] bg-[rgba(15,12,12,0.52)] p-4 text-right">
            {amount ? (
              <p className="text-lg font-semibold text-[var(--text-strong)]">
                {amount}
              </p>
            ) : null}
            {meta ? (
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {meta}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <section key={section.title} className="surface-card p-4">
              <p className="section-kicker">{section.title}</p>
              <div className="mt-3 space-y-3">
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.label}`}>
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-strong)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>

      {href && hrefLabel ? (
        <div className="mt-5">
          <Link
            href={href}
            className="btn-secondary inline-flex min-h-11 items-center justify-center px-4 py-3 text-sm font-medium"
          >
            {hrefLabel}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
