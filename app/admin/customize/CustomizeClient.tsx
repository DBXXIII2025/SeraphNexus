"use client";

import { useState } from "react";
import {
  getBusinessProfileCompletion,
  normalizeBusinessSlug,
  type BusinessProfileCompletion,
} from "@/lib/businessProfileCompletion";

type CustomizeClientProps = {
  initialBusiness: {
    id: string;
    name: string;
    slug: string;
    description: string;
    business_type: string;
  };
  initialCompletion: BusinessProfileCompletion;
};

export default function CustomizeClient({
  initialBusiness,
  initialCompletion,
}: CustomizeClientProps) {
  const [form, setForm] = useState(initialBusiness);
  const [savedCompletion, setSavedCompletion] = useState(initialCompletion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const completion = getBusinessProfileCompletion(form);
  const slugPreview = normalizeBusinessSlug(form.slug || form.name || "");
  const isRentalBusiness =
    form.business_type === "rental" || form.business_type === "property";
  const publicRoutePrefix = isRentalBusiness
    ? "rent"
    : form.business_type === "restaurant" ||
        form.business_type === "food"
      ? "order"
      : form.business_type === "creator" ||
          form.business_type === "store" ||
          form.business_type === "product"
        ? "shop"
      : "book";

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/admin/business/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Business profile could not be updated.");
      setLoading(false);
      return;
    }

    const nextForm = {
      ...form,
      slug: data.business?.slug || normalizeBusinessSlug(form.slug || form.name || ""),
      name: data.business?.name || form.name,
      description: data.business?.description || form.description,
    };

    setForm(nextForm);
    setSavedCompletion(getBusinessProfileCompletion(nextForm));
    setSuccess("Business profile updated.");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-white">
      <div>
        <h1 className="font-heading text-2xl">Business Profile</h1>
        <p className="mt-2 text-sm text-gray-400">
          Keep your public business details complete so customers can trust what
          they see before they book, order, or inquire.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Profile completion</p>
            <p className="mt-1 text-sm text-gray-400">{completion.summary}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-white">
            {completion.progressPercent}% complete
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${completion.progressPercent}%` }}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {completion.fields.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
            >
              <span className="font-medium text-white">{field.label}</span>
              <span
                className={`ml-2 ${
                  field.missing ? "text-yellow-300" : "text-emerald-300"
                }`}
              >
                {field.missing ? (field.required ? "Required" : "Recommended") : "Ready"}
              </span>
            </div>
          ))}
        </div>

        {savedCompletion.canPublishProfile && !completion.canPublishProfile ? (
          <p className="mt-4 text-xs text-gray-500">
            Saving incomplete changes will make the business profile no longer publish-ready.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <p className="mb-1 text-sm">Business name</p>
          <input
            placeholder="Business name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 p-2"
          />
        </div>

        <div>
          <p className="mb-1 text-sm">Public slug</p>
          <input
            placeholder="public-business-slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 p-2"
          />
          <p className="mt-2 text-xs text-gray-400">
            Preview: /{publicRoutePrefix}/{slugPreview || "your-business"}
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm">Business description</p>
          <textarea
            placeholder="Describe what customers should know before they visit, book, order, or inquire."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="min-h-32 w-full rounded border border-neutral-700 bg-neutral-800 p-2"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded bg-purple-700 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save Profile"}
          </button>
          <a
            href="/admin/settings"
            className="rounded border border-neutral-700 px-4 py-2 text-sm text-white"
          >
            Review publish readiness
          </a>
        </div>
      </div>
    </div>
  );
}
