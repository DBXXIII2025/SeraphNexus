"use client";

import { useState } from "react";
import { createAdminTranslator } from "@/lib/adminI18n";
import { translate } from "@/lib/i18n";

type BusinessPreferences = {
  id: string;
  business_type?: string | null;
  language?: "en" | "es" | null;
  pickup_enabled?: boolean | null;
  delivery_enabled?: boolean | null;
  onsite_enabled?: boolean | null;
  remote_enabled?: boolean | null;
};

function isFoodBusiness(type?: string | null) {
  return type === "food" || type === "restaurant";
}

function isOrderModeBusiness(type?: string | null) {
  return (
    type === "food" ||
    type === "restaurant" ||
    type === "store" ||
    type === "product" ||
    type === "creator"
  );
}

function isServiceBusiness(type?: string | null) {
  return type === "service";
}

export default function BusinessPreferencesForm({
  business,
}: {
  business: BusinessPreferences;
}) {
  const [language, setLanguage] = useState<"en" | "es">(
    business.language === "es" ? "es" : "en"
  );
  const [pickupEnabled, setPickupEnabled] = useState(
    business.pickup_enabled !== false
  );
  const [deliveryEnabled, setDeliveryEnabled] = useState(
    business.delivery_enabled !== false
  );
  const [onsiteEnabled, setOnsiteEnabled] = useState(
    business.onsite_enabled !== false
  );
  const [remoteEnabled, setRemoteEnabled] = useState(
    business.remote_enabled !== false
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = createAdminTranslator(language);
  const label = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const showOrderModes = isOrderModeBusiness(business.business_type);
  const showServiceModes = isServiceBusiness(business.business_type);

  async function savePreferences() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/business/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: business.id,
        language,
        pickup_enabled: pickupEnabled,
        delivery_enabled: deliveryEnabled,
        onsite_enabled: onsiteEnabled,
        remote_enabled: remoteEnabled,
      }),
    });
    const data = await res.json().catch(() => ({}));

    setSaving(false);
    if (!res.ok) {
      setError(data?.error || "Failed to save preferences.");
      return;
    }

    setMessage("Preferences saved.");
  }

  function updateFoodMode(mode: "pickup" | "delivery", checked: boolean) {
    if (mode === "pickup") {
      if (!checked && !deliveryEnabled) return;
      setPickupEnabled(checked);
    } else {
      if (!checked && !pickupEnabled) return;
      setDeliveryEnabled(checked);
    }
  }

  function updateServiceMode(mode: "onsite" | "remote", checked: boolean) {
    if (mode === "onsite") {
      if (!checked && !remoteEnabled) return;
      setOnsiteEnabled(checked);
    } else {
      if (!checked && !onsiteEnabled) return;
      setRemoteEnabled(checked);
    }
  }

  return (
    <section className="surface-card p-6">
      <div className="section-header-copy">
        <p className="section-kicker">{t("preferences")}</p>
        <h2 className="section-title">{label("language")} and operating modes</h2>
        <p className="section-description">
          Control customer-facing labels and allowed fulfillment modes.
        </p>
      </div>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--text-soft)]">{label("language")}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value === "es" ? "es" : "en")}
            className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-strong)]"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </label>

        {showOrderModes ? (
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-medium text-[var(--text-strong)]">
              {isFoodBusiness(business.business_type) ? "Food fulfillment" : "Order fulfillment"}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--text-soft)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pickupEnabled}
                  onChange={(event) => updateFoodMode("pickup", event.target.checked)}
                />
                {label("pickup")}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deliveryEnabled}
                  onChange={(event) => updateFoodMode("delivery", event.target.checked)}
                />
                {label("delivery")}
              </label>
            </div>
          </div>
        ) : null}

        {showServiceModes ? (
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-medium text-[var(--text-strong)]">{label("serviceMode")}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--text-soft)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onsiteEnabled}
                  onChange={(event) => updateServiceMode("onsite", event.target.checked)}
                />
                {label("onsite")}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={remoteEnabled}
                  onChange={(event) => updateServiceMode("remote", event.target.checked)}
                />
                {label("remote")}
              </label>
            </div>
          </div>
        ) : null}

        {!showOrderModes && !showServiceModes ? (
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-soft)]">
            Property and rental businesses are always on-site. No remote, pickup, or delivery
            toggles are shown.
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {message ? <p className="text-sm text-green-300">{message}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void savePreferences()}
          className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t("saving") : t("savePreferences")}
        </button>
      </div>
    </section>
  );
}
