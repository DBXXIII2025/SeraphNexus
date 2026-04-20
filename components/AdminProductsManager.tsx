"use client";

import Link from "next/link";
import { useState } from "react";
import { getTenantQuickstart } from "@/lib/tenantQuickstart";
import { createAdminTranslator } from "@/lib/adminI18n";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_active?: boolean | null;
};

type FormState = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  image_url: string;
  is_active: boolean;
};

function emptyForm(): FormState {
  return {
    id: null,
    name: "",
    description: "",
    price: "",
    image_url: "",
    is_active: true,
  };
}

export default function AdminProductsManager({
  businessId,
  businessType,
  initialProducts,
  language,
}: {
  businessId: string;
  businessType: string | null | undefined;
  language?: "en" | "es" | null;
  initialProducts: Product[];
}) {
  const t = createAdminTranslator(language);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageTitle =
    businessType === "restaurant" || businessType === "food" ? t("menu") : t("products");
  const quickstart = getTenantQuickstart(businessType);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || !data?.url) {
      throw new Error(data?.error || "Failed to upload image");
    }

    setForm((prev) => ({
      ...prev,
      image_url: data.url,
    }));
  }

  function startEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      image_url: product.image_url || "",
      is_active: product.is_active !== false,
    });
    setMessage(null);
    setError(null);
  }

  function resetForm() {
    setForm(emptyForm());
  }

  async function handleSave() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const price = Number(form.price);
      if (!form.name.trim()) {
        throw new Error("Item name is required");
      }
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Price must be greater than 0");
      }

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save",
          id: form.id,
          businessId,
          name: form.name.trim(),
          description: form.description.trim(),
          price,
          image_url: form.image_url.trim(),
          is_active: form.is_active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save item");
      }

      const savedProduct = data?.product as Product | undefined;
      if (!savedProduct) {
        throw new Error("Saved item was not returned");
      }

      setProducts((prev) => {
        const existing = prev.find((item) => item.id === savedProduct.id);
        if (existing) {
          return prev.map((item) => (item.id === savedProduct.id ? savedProduct : item));
        }
        return [savedProduct, ...prev];
      });

      setMessage(form.id ? "Item updated." : "Item created.");
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setLoading(false);
    }
  }

  async function handleLifecycleAction(
    product: Product,
    action: "delete" | "archive" | "restore"
  ) {
    const confirmed = window.confirm(
      action === "delete"
        ? `Delete "${product.name}" if it has no history, or archive it if historical orders depend on it?`
        : action === "archive"
          ? `Archive "${product.name}" and remove it from future purchases?`
          : `Restore "${product.name}" to the live catalog?`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          id: product.id,
          businessId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }

      if (data?.deleted) {
        setProducts((prev) => prev.filter((item) => item.id !== product.id));
        setMessage("Item deleted.");
        if (form.id === product.id) {
          resetForm();
        }
        return;
      }

      const next = data?.product as Product | undefined;
      if (!next) {
        throw new Error("Updated item was not returned");
      }

      setProducts((prev) => prev.map((item) => (item.id === next.id ? next : item)));
      setMessage(
        action === "restore"
          ? "Item restored."
          : data?.archived || action === "archive"
            ? "Item archived."
            : "Item updated."
      );

      if (form.id === next.id) {
        startEdit(next);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6 text-[var(--text-main)]">
      <div>
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        <p className="text-sm text-[var(--text-soft)]">
          Edit the live catalog for this business. New prices apply to future purchases only.
          Historical orders keep the original charged totals.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-yellow-200">Quickstart</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-main)]">{quickstart.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-yellow-100/90">
            {quickstart.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="#create-item"
              className="rounded-md bg-[var(--success)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--success)]"
            >
              {quickstart.primaryLabel}
            </a>
            <Link
              href={quickstart.secondaryHref}
              className="rounded-md border border-[var(--border-soft)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--accent-muted)]"
            >
              {quickstart.secondaryLabel}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div id="create-item" className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {form.id ? "Edit Item" : `Create ${pageTitle.slice(0, -1) || "Item"}`}
            </h2>
            {form.id && (
              <button
                type="button"
                className="text-sm text-[var(--text-soft)] underline"
                onClick={resetForm}
              >
                Cancel edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
            />

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="min-h-[120px] w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
            />

            <input
              placeholder="Price (USD)"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
            />

            <select
              value={form.is_active ? "active" : "archived"}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, is_active: e.target.value === "active" }))
              }
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                uploadFile(file).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Failed to upload image");
                });
              }}
            />

            {form.image_url && (
              <img src={form.image_url} alt="Preview" className="h-40 w-full rounded-lg object-cover" />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-green-400">{message}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-md bg-[var(--success)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--success)] disabled:opacity-60"
            >
              {loading ? "Saving..." : form.id ? "Save Changes" : "Create Item"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6">
          <h2 className="mb-4 text-lg font-semibold">Live Catalog</h2>
          {products.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-soft)]">
                No items yet. Create the first real catalog entry to unlock order-ready setup.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#create-item"
                  className="rounded-md bg-[var(--success)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--success)]"
                >
                  {quickstart.primaryLabel}
                </a>
                <Link
                  href={quickstart.secondaryHref}
                  className="rounded-md border border-[var(--border-soft)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--accent-muted)]"
                >
                  {quickstart.secondaryLabel}
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <button type="button" onClick={() => startEdit(product)} className="text-left">
                        <p className="font-medium text-[var(--text-main)]">{product.name}</p>
                      </button>
                      {product.description && (
                        <p className="mt-1 text-sm text-[var(--text-soft)]">{product.description}</p>
                      )}
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {product.is_active === false ? "Archived" : "Active"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">
                      ${Number(product.price).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      className="rounded-md border border-[var(--border-soft)] px-3 py-2 text-sm text-[var(--text-main)] transition hover:bg-[var(--accent-muted)]"
                    >
                      Edit
                    </button>
                    {product.is_active === false ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleLifecycleAction(product, "restore")}
                        className="rounded-md border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-60"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleLifecycleAction(product, "archive")}
                        className="rounded-md border border-amber-500/30 px-3 py-2 text-sm text-[var(--warning)] transition hover:bg-amber-500/10 disabled:opacity-60"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleLifecycleAction(product, "delete")}
                      className="rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
