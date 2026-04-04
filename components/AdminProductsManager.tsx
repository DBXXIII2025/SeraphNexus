"use client";

import Link from "next/link";
import { useState } from "react";
import { getTenantQuickstart } from "@/lib/tenantQuickstart";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
};

type FormState = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  image_url: string;
};

function emptyForm(): FormState {
  return {
    id: null,
    name: "",
    description: "",
    price: "",
    image_url: "",
  };
}

export default function AdminProductsManager({
  businessId,
  businessType,
  initialProducts,
}: {
  businessId: string;
  businessType: string | null | undefined;
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageTitle =
    businessType === "restaurant" || businessType === "food"
      ? "Menu Items"
      : "Products";
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

      const res = await fetch("/api/admin/products/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: form.id,
          businessId,
          name: form.name.trim(),
          description: form.description.trim(),
          price,
          image_url: form.image_url.trim(),
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
          return prev.map((item) =>
            item.id === savedProduct.id ? savedProduct : item
          );
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

  return (
    <div className="max-w-5xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        <p className="text-sm text-gray-400">
          Edit the live catalog for this business. Prices are stored in dollars
          and used as the server source of truth for checkout.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-yellow-200">Quickstart</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{quickstart.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-yellow-100/90">
            {quickstart.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="#create-item"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500"
            >
              {quickstart.primaryLabel}
            </a>
            <Link
              href={quickstart.secondaryHref}
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
            >
              {quickstart.secondaryLabel}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div id="create-item" className="rounded-xl border border-white/10 bg-zinc-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {form.id ? "Edit Item" : `Create ${pageTitle.slice(0, -1) || "Item"}`}
            </h2>
            {form.id && (
              <button
                type="button"
                className="text-sm text-gray-400 underline"
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
              className="w-full rounded-md border border-white/10 bg-black/40 p-2"
            />

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="min-h-[120px] w-full rounded-md border border-white/10 bg-black/40 p-2"
            />

            <input
              placeholder="Price (USD)"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              className="w-full rounded-md border border-white/10 bg-black/40 p-2"
            />

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
              <img
                src={form.image_url}
                alt="Preview"
                className="h-40 w-full rounded-lg object-cover"
              />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-green-400">{message}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500 disabled:opacity-60"
            >
              {loading ? "Saving..." : form.id ? "Save Changes" : "Create Item"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6">
          <h2 className="mb-4 text-lg font-semibold">Live Catalog</h2>
          {products.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                No items yet. Create the first real catalog entry to unlock order-ready setup.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#create-item"
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500"
                >
                  {quickstart.primaryLabel}
                </a>
                <Link
                  href={quickstart.secondaryHref}
                  className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  {quickstart.secondaryLabel}
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => startEdit(product)}
                  className="block w-full rounded-lg border border-white/10 bg-black/30 p-4 text-left hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      {product.description && (
                        <p className="mt-1 text-sm text-gray-400">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white">
                      ${Number(product.price).toFixed(2)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

