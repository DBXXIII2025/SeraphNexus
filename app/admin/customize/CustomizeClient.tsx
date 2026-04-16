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
    <div className="mx-auto max-w-6xl space-y-4 p-3 text-slate-900 sm:p-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
        <h1 className="font-heading text-2xl text-slate-950">Business Profile</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          The preview uses the same compact public header, gallery, and information layout customers see.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[410px_minmax(0,1fr)] lg:items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_44px_rgba(15,23,42,0.08)] lg:sticky lg:top-4">
          <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Live preview
              </p>
              <p className="mt-1 text-sm text-slate-600">Public card layout</p>
            </div>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
              Live
            </span>
          </div>
          <div
            className="overflow-hidden rounded-lg border border-slate-200 p-2"
            style={{
              width: "100%",
              maxWidth: "384px",
              backgroundColor: previewTheme.backgroundColor,
            }}
          >
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

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            planNotice.tone === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {planNotice.message}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-950">Profile completion</p>
              <p className="mt-1 text-sm text-slate-600">{completion.summary}</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-900">
              {completion.progressPercent}% complete
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${completion.progressPercent}%` }}
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {completion.fields.map((field) => (
              <div
                key={field.key}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-900">{field.label}</span>
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

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-950">Header and business information</h2>
            <p className="mt-1 text-sm text-slate-600">
              These fields feed the compact public header and the detail block below the gallery.
            </p>
          </div>
          <div className="space-y-3">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Business name</p>
          <input
            placeholder="Business name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-slate-300 bg-white p-2 text-slate-950"
          />
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Public slug</p>
          <input
            placeholder="public-business-slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full rounded border border-slate-300 bg-white p-2 text-slate-950"
          />
          <p className="mt-2 text-xs text-slate-500">
            Preview: /{publicRoutePrefix}/{slugPreview || "your-business"}
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Business description</p>
          <textarea
            placeholder="Describe what customers should know before they visit, book, order, or inquire."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="min-h-32 w-full rounded border border-slate-300 bg-white p-2 text-slate-950"
          />
        </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Business logo</h2>
              <p className="mt-1 text-sm text-slate-600">
                This logo appears in the compact public header.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800">
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
                className="rounded border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove logo
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-950">Business information styling</h2>
            <p className="mt-1 text-sm text-slate-600">
              Colors and font sizes apply to the compact header and readable business details.
            </p>
          </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Page background/theme color</p>
            <input
              type="color"
              value={form.page_accent_color}
              onChange={(e) => setForm({ ...form, page_accent_color: e.target.value })}
              className="h-11 w-full rounded border border-slate-300 bg-white p-1"
            />
            <p className="mt-2 text-xs text-slate-500">
              This saved theme color drives the public buttons, accents, and page background tint.
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Page text color</p>
            <input
              type="color"
              value={form.page_text_color}
              onChange={(e) => setForm({ ...form, page_text_color: e.target.value })}
              className="h-11 w-full rounded border border-slate-300 bg-white p-1"
            />
            <p className="mt-2 text-xs text-slate-500">
              Very low-contrast text colors are saved as the readable default.
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Heading font size</p>
            <input
              type="number"
              min="24"
              max="56"
              value={form.heading_font_size}
              onChange={(e) =>
                setForm({ ...form, heading_font_size: Number(e.target.value) })
              }
              className="w-full rounded border border-slate-300 bg-white p-2 text-slate-950"
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Body font size</p>
            <input
              type="number"
              min="14"
              max="20"
              value={form.body_font_size}
              onChange={(e) =>
                setForm({ ...form, body_font_size: Number(e.target.value) })
              }
              className="w-full rounded border border-slate-300 bg-white p-2 text-slate-950"
            />
          </div>
        </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Gallery image area</h2>
              <p className="mt-1 text-sm text-slate-600">
                Manage the compact framed public carousel without enlarging the control panel.
              </p>
            </div>
            <label className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800">
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
            <p className="mt-3 text-sm text-amber-700">{customizationErrorMessage}</p>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {galleryImages.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Upload photos to publish a gallery.
              </div>
            ) : (
              galleryImages.map((image, index) => (
                <div key={image.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <img src={image.image_url} alt={image.alt_text || "Business gallery photo"} className="aspect-square w-full object-cover" />
                  <div className="space-y-2 p-2 text-xs">
                    <span className="block font-medium text-slate-700">
                      {image.is_primary ? "Primary photo" : `Photo ${index + 1}`}
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      <button type="button" onClick={() => void markPrimaryPhoto(image.id)} className="rounded border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-50" disabled={image.is_primary}>Primary</button>
                      <button type="button" onClick={() => void moveGalleryPhoto(image.id, -1)} className="rounded border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-50" disabled={index === 0}>Up</button>
                      <button type="button" onClick={() => void moveGalleryPhoto(image.id, 1)} className="rounded border border-slate-200 px-2 py-1 text-slate-700 disabled:opacity-50" disabled={index === galleryImages.length - 1}>Down</button>
                      <button type="button" onClick={() => void removeGalleryPhoto(image.id)} className="rounded border border-red-200 px-2 py-1 text-red-700">Remove</button>
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
            className="rounded bg-slate-950 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save Profile"}
          </button>
          <a
            href="/admin/settings"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
          >
            Review publish readiness
          </a>
        </div>
        </div>
      </div>
    </div>
  );
}
