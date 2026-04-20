"use client";

import Link from "next/link";
import { getPublicPath } from "@/lib/businessModules";
import type { TransactionConfirmationPayload } from "@/lib/transactionConfirmation";

function getStateTone(state: TransactionConfirmationPayload["state"]) {
  if (state === "confirmed") {
    return {
      badge: "Confirmed",
      badgeClass:
        "border-[var(--success)] bg-[var(--success-bg)] text-[var(--success)]",
      panelClass: "premium-card",
    };
  }

  if (state === "finalizing") {
    return {
      badge: "Finalizing",
      badgeClass:
        "border-[var(--border-soft)] bg-[var(--muted-bg)] text-[var(--text-soft)]",
      panelClass: "surface-card",
    };
  }

  return {
    badge: "Needs Review",
    badgeClass:
      "border-[var(--destructive)] bg-[var(--destructive-bg)] text-[var(--destructive)]",
    panelClass: "surface-card",
  };
}

function getPrimaryHref(confirmation: TransactionConfirmationPayload) {
  if (confirmation.primaryActionHref) {
    return confirmation.primaryActionHref;
  }

  if (confirmation.businessSlug) {
    return getPublicPath(
      confirmation.businessType || undefined,
      confirmation.businessSlug
    );
  }

  return "/";
}

function getPrimaryLabel(confirmation: TransactionConfirmationPayload) {
  if (confirmation.primaryActionLabel) {
    return confirmation.primaryActionLabel;
  }

  return confirmation.businessName ? "Return to business" : "Return home";
}

export default function TransactionConfirmationShell({
  confirmation,
}: {
  confirmation: TransactionConfirmationPayload;
}) {
  const tone = getStateTone(confirmation.state);

  return (
    <div className="circuit-shell min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)] sm:px-6">
      <div className="relative mx-auto max-w-5xl space-y-6">
        <section className={`${tone.panelClass} overflow-hidden p-6 sm:p-8`}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <span
                className={`inline-flex items-center rounded-full border px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] ${tone.badgeClass}`}
              >
                {tone.badge}
              </span>
              <p className="section-kicker mt-5">
                {confirmation.businessName || "Seraph Nexus"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] sm:text-4xl">
                {confirmation.headline}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">
                {confirmation.message}
              </p>
            </div>

            <div className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-5">
              <p className="section-kicker">Next step</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                {confirmation.nextStep}
              </p>

              <div className="mt-5 space-y-3 text-sm">
                {confirmation.reference ? (
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-3">
                    <span className="text-[var(--text-muted)]">Reference</span>
                    <span className="text-right font-medium text-[var(--text-strong)]">
                      {confirmation.reference}
                    </span>
                  </div>
                ) : null}
                {confirmation.paymentSummary ? (
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-3">
                    <span className="text-[var(--text-muted)]">Payment</span>
                    <span className="text-right font-medium text-[var(--text-strong)]">
                      {confirmation.paymentSummary}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {confirmation.sections.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {confirmation.sections.map((section) => (
              <article key={section.title} className="surface-card p-5">
                <p className="section-kicker">{section.title}</p>
                <div className="mt-4 space-y-4">
                  {section.items.map((item) => (
                    <div key={`${section.title}-${item.label}`}>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-strong)]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        <section className="flex flex-wrap gap-3">
          <Link
            href={getPrimaryHref(confirmation)}
            className="btn-primary inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-medium"
          >
            {getPrimaryLabel(confirmation)}
          </Link>
          <Link
            href={confirmation.secondaryActionHref || "/messages"}
            className="btn-secondary inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-medium"
          >
            {confirmation.secondaryActionLabel || "Check messages"}
          </Link>
        </section>
      </div>
    </div>
  );
}
