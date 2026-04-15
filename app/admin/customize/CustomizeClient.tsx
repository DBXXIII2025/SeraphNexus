"use client";

import { useState } from "react";
import {
  getBusinessProfileCompletion,
  normalizeBusinessSlug,
  type BusinessProfileCompletion,
} from "@/lib/businessProfileCompletion";
import BusinessProfileShell from "@/components/BusinessProfileShell";
import {
  normalizeBusinessPageTheme,
  type BusinessPageImage,
} from "@/lib/businessPageCustomization";

type CustomizeClientProps = {
  initialBusiness: {
    id: string;
    name: string;
    slug: string;
    description: string;
    business_type: string;
    page_accent_color: string;
    page_text_color: string;
    heading_font_size: number;
    body_font_size: number;
  };
  initialLogoUrl: string | null;
  initialGalleryImages: BusinessPageImage[];
  customizationSchemaReady: boolean;
  customizationErrorMessage: string | null;
  initialCompletion: BusinessProfileCompletion;
  planNotice: {
    tone: "warning" | "success";
    message: string;
  };
};

export default function CustomizeClient({
  initialBusiness,
  initialLogoUrl,
  initialGalleryImages,
  customizationSchemaReady,
  customizationErrorMessage,
  initialCompletion,
  planNotice,
}: CustomizeClientProps) {
  const [form, setForm] = useState(initialBusiness);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [galleryImages, setGalleryImages] = useState(initialGalleryImages);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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
      page_accent_color: data.business?.page_accent_color || form.page_accent_color,
      page_text_color: data.business?.page_text_color || form.page_text_color,
      heading_font_size: data.business?.heading_font_size || form.heading_font_size,
      body_font_size: data.business?.body_font_size || form.body_font_size,
    };

    setForm(nextForm);
    setSavedCompletion(getBusinessProfileCompletion(nextForm));
    setSuccess("Business profile updated.");
    setLoading(false);
  }

  async function uploadGalleryPhoto(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setUploadingPhoto(true);
    setError(null);
    setSuccess(null);

    try {
      const uploadForm = new FormData();
      uploadForm.set("file", fileList[0]);
      const res = await fetch("/api/admin/business/gallery", {
        method: "POST",
        body: uploadForm,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Photo upload failed.");
      }
      setGalleryImages((current) =>
        Array.isArray(data.images)
          ? data.images
          : [...current.filter((image) => image.id !== data.image?.id), data.image]
      );
      setSuccess("Gallery photo added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadLogo(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setUploadingLogo(true);
    setError(null);
    setSuccess(null);

    try {
      const uploadForm = new FormData();
      uploadForm.set("businessId", form.id);
      uploadForm.set("file", fileList[0]);
      const res = await fetch("/api/admin/business/logo", {
        method: "POST",
        body: uploadForm,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Logo upload failed.");
      }
      setLogoUrl(data.logoUrl || null);
      setSuccess("Business logo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!logoUrl) {
      return;
    }

    setUploadingLogo(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/business/logo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: form.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Logo could not be removed.");
      }
      setLogoUrl(null);
      setSuccess("Business logo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo could not be removed.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeGalleryPhoto(imageId: string) {
    setError(null);
    setSuccess(null);
    const previous = galleryImages;
    setGalleryImages((current) => current.filter((image) => image.id !== imageId));

    try {
      const res = await fetch("/api/admin/business/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Photo could not be removed.");
      }
      if (Array.isArray(data.images)) {
        setGalleryImages(data.images);
      }
      setSuccess("Gallery photo removed.");
    } catch (err) {
      setGalleryImages(previous);
      setError(err instanceof Error ? err.message : "Photo could not be removed.");
    }
  }

  async function moveGalleryPhoto(imageId: string, direction: -1 | 1) {
    const index = galleryImages.findIndex((image) => image.id === imageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= galleryImages.length) {
      return;
    }

    const reordered = [...galleryImages];
    const [image] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, image);
    setGalleryImages(reordered);

    const res = await fetch("/api/admin/business/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((entry) => entry.id) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setGalleryImages(galleryImages);
      setError(data.error || "Photo order could not be saved.");
      return;
    }
    if (Array.isArray(data.images)) {
      setGalleryImages(data.images);
    }
  }

  async function markPrimaryPhoto(imageId: string) {
    setError(null);
    setSuccess(null);

    const previous = galleryImages;
    const selected = galleryImages.find((image) => image.id === imageId);
    if (!selected) {
      return;
    }

    setGalleryImages([
      { ...selected, is_primary: true, sort_order: 1 },
      ...galleryImages
        .filter((image) => image.id !== imageId)
        .map((image, index) => ({ ...image, is_primary: false, sort_order: index + 2 })),
    ]);

    const res = await fetch("/api/admin/business/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryImageId: imageId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setGalleryImages(previous);
      setError(data.error || "Primary photo could not be saved.");
      return;
    }
    if (Array.isArray(data.images)) {
      setGalleryImages(data.images);
    }
    setSuccess("Primary gallery photo updated.");
  }

  const previewTheme = normalizeBusinessPageTheme({
    page_accent_color: form.page_accent_color,
    page_text_color: form.page_text_color,
    heading_font_size: form.heading_font_size,
    body_font_size: form.body_font_size,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-2 text-white sm:p-3">
      <div className="rounded-lg border border-white/10 bg-zinc-950/80 px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
        <h1 className="font-heading text-xl">Business Profile</h1>
        <p className="mt-1.5 text-sm text-gray-400">
          The preview uses the same compact public header, gallery, and information layout customers see.
        </p>
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

      <div className="grid gap-3 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
        <div className="rounded-lg border border-white/10 bg-zinc-950/85 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] lg:sticky lg:top-3">
          <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Live preview
              </p>
              <p className="mt-1 text-sm text-gray-300">Public card layout</p>
            </div>
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
              Live
            </span>
          </div>
          <div
            className="relative overflow-hidden rounded-lg border border-red-500 bg-[#f5f7fb] p-2 outline outline-2 outline-red-500"
            style={{ width: "100%", maxWidth: "384px" }}
          >
            <span className="pointer-events-none absolute left-2 top-2 z-30 rounded bg-red-700 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
              ADMIN_PREVIEW_WRAPPER
            </span>
            <BusinessProfileShell
              businessName={form.name || "Business"}
              businessDescription={form.description}
              businessType={form.business_type}
              logoUrl={logoUrl}
              images={galleryImages}
              theme={previewTheme}
              compact
            />
          </div>
        </div>

        <div className="relative space-y-2.5 rounded-lg border border-yellow-400 bg-zinc-950/80 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.24)] outline outline-2 outline-yellow-400">
        <span className="pointer-events-none absolute right-2 top-2 z-30 rounded bg-yellow-500 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-black">
          ADMIN_CONTROLS_PANEL
        </span>
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            planNotice.tone === "warning"
              ? "border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] text-[var(--accent-gold-soft)]"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {planNotice.message}
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/85 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Profile completion</p>
              <p className="mt-1 text-sm text-gray-400">{completion.summary}</p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-white">
              {completion.progressPercent}% complete
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${completion.progressPercent}%` }}
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

        <div className="rounded-lg border border-white/10 bg-zinc-900/85 p-3.5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-white">Header and business information</h2>
            <p className="mt-1 text-sm text-gray-400">
              These fields feed the compact public header and the detail block below the gallery.
            </p>
          </div>
          <div className="space-y-3">
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
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-zinc-900/85 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Business logo</h2>
              <p className="mt-1 text-sm text-gray-400">
                This logo appears in the compact public header.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="rounded border border-neutral-700 px-4 py-2 text-sm text-white">
                {uploadingLogo ? "Uploading..." : logoUrl ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploadingLogo}
                  onChange={(event) => void uploadLogo(event.target.files)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => void removeLogo()}
                disabled={uploadingLogo || !logoUrl}
                className="rounded border border-red-500/30 px-4 py-2 text-sm text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove logo
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-zinc-900/85 p-3.5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-white">Business information styling</h2>
            <p className="mt-1 text-sm text-gray-400">
              Colors and font sizes apply to the compact header and readable business details.
            </p>
          </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm">Page accent color</p>
            <input
              type="color"
              value={form.page_accent_color}
              onChange={(e) => setForm({ ...form, page_accent_color: e.target.value })}
              className="h-11 w-full rounded border border-neutral-700 bg-neutral-800 p-1"
            />
          </div>
          <div>
            <p className="mb-1 text-sm">Page text color</p>
            <input
              type="color"
              value={form.page_text_color}
              onChange={(e) => setForm({ ...form, page_text_color: e.target.value })}
              className="h-11 w-full rounded border border-neutral-700 bg-neutral-800 p-1"
            />
            <p className="mt-2 text-xs text-gray-400">
              Very low-contrast text colors are saved as the readable default.
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm">Heading font size</p>
            <input
              type="number"
              min="24"
              max="56"
              value={form.heading_font_size}
              onChange={(e) =>
                setForm({ ...form, heading_font_size: Number(e.target.value) })
              }
              className="w-full rounded border border-neutral-700 bg-neutral-800 p-2"
            />
          </div>
          <div>
            <p className="mb-1 text-sm">Body font size</p>
            <input
              type="number"
              min="14"
              max="20"
              value={form.body_font_size}
              onChange={(e) =>
                setForm({ ...form, body_font_size: Number(e.target.value) })
              }
              className="w-full rounded border border-neutral-700 bg-neutral-800 p-2"
            />
          </div>
        </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-zinc-900/85 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Gallery image area</h2>
              <p className="mt-1 text-sm text-gray-400">
                Manage the compact framed gallery shown below the public header.
              </p>
            </div>
            <label className="rounded border border-neutral-700 px-4 py-2 text-sm text-white">
              {uploadingPhoto ? "Uploading..." : "Add photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploadingPhoto}
                onChange={(event) => void uploadGalleryPhoto(event.target.files)}
                className="hidden"
              />
            </label>
          </div>
          {customizationErrorMessage ? (
            <p className="mt-3 text-sm text-yellow-200">{customizationErrorMessage}</p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {galleryImages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 p-5 text-sm text-gray-400">
                Upload photos to publish a gallery.
              </div>
            ) : (
              galleryImages.map((image, index) => (
                <div key={image.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  <img src={image.image_url} alt={image.alt_text || "Business gallery photo"} className="aspect-[4/3] w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="text-gray-300">
                      {image.is_primary ? "Primary photo" : `Photo ${index + 1}`}
                    </span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void markPrimaryPhoto(image.id)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-50" disabled={image.is_primary}>Primary</button>
                      <button type="button" onClick={() => void moveGalleryPhoto(image.id, -1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-50" disabled={index === 0}>Up</button>
                      <button type="button" onClick={() => void moveGalleryPhoto(image.id, 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-50" disabled={index === galleryImages.length - 1}>Down</button>
                      <button type="button" onClick={() => void removeGalleryPhoto(image.id)} className="rounded border border-red-500/30 px-2 py-1 text-red-200">Remove</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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
    </div>
  );
}
