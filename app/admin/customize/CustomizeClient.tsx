"use client";

import { useRef, useState } from "react";
import {
  getBusinessProfileCompletion,
  normalizeBusinessSlug,
  type BusinessProfileCompletion,
} from "@/lib/businessProfileCompletion";
import BusinessProfileShell from "@/components/BusinessProfileShell";
import {
  isAllowedBusinessPageImageType,
  MAX_BUSINESS_GALLERY_IMAGES,
  normalizeBusinessPageTheme,
  type BusinessPageImage,
} from "@/lib/businessPageCustomization";

const CLIENT_MAX_ORIGINAL_IMAGE_BYTES = 40 * 1024 * 1024;
const CLIENT_MAX_UPLOAD_IMAGE_BYTES = 8 * 1024 * 1024;
const GALLERY_IMAGE_MAX_DIMENSION = 1800;
const IMAGE_TOO_LARGE_MESSAGE = "Image too large. Please upload a smaller file.";
const GALLERY_LIMIT_MESSAGE = "You can upload up to 20 gallery images.";

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
    phone: string;
    email: string;
    website: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    social_facebook: string;
    social_instagram: string;
    social_twitter: string;
    service_area: string;
  };
  initialLogoUrl: string | null;
  initialGalleryImages: BusinessPageImage[];
  platformBrand: {
    siteName: string;
    logoUrl?: string | null;
  };
  customizationSchemaReady: boolean;
  customizationErrorMessage: string | null;
  profileFieldsSchemaReady: boolean;
  profileFieldsErrorMessage: string | null;
  initialCompletion: BusinessProfileCompletion;
  planNotice: {
    tone: "warning" | "success";
    message: string;
  };
};

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be read."));
    };
    image.src = objectUrl;
  });
}

async function compressGalleryImage(file: File) {
  if (file.size <= CLIENT_MAX_UPLOAD_IMAGE_BYTES) {
    console.log("[admin/customize] gallery file within upload limit", {
      fileName: file.name,
      originalSize: file.size,
      maxUploadSize: CLIENT_MAX_UPLOAD_IMAGE_BYTES,
    });
    return file;
  }

  const image = await loadImageElement(file);
  const scale = Math.min(
    1,
    GALLERY_IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image could not be compressed.");
  }

  context.drawImage(image, 0, 0, width, height);

  const qualityLevels = [0.82, 0.72, 0.62, 0.52, 0.42];
  for (const quality of qualityLevels) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (!blob) {
      continue;
    }

    console.log("[admin/customize] gallery compression attempt", {
      fileName: file.name,
      originalSize: file.size,
      compressedSize: blob.size,
      quality,
      width,
      height,
    });

    if (blob.size <= CLIENT_MAX_UPLOAD_IMAGE_BYTES) {
      const safeName = file.name.replace(/\.[^.]+$/, "") || "business-photo";
      return new File([blob], `${safeName}.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
      });
    }
  }

  throw new Error(IMAGE_TOO_LARGE_MESSAGE);
}

function validateGalleryFilesBeforeUpload(files: File[]) {
  for (const file of files) {
    if (!isAllowedBusinessPageImageType(file.type)) {
      return "Only JPG, PNG, and WEBP photos are allowed.";
    }

    if (file.size > CLIENT_MAX_ORIGINAL_IMAGE_BYTES) {
      return IMAGE_TOO_LARGE_MESSAGE;
    }
  }

  return null;
}

export default function CustomizeClient({
  initialBusiness,
  initialLogoUrl,
  initialGalleryImages,
  platformBrand,
  customizationSchemaReady,
  customizationErrorMessage,
  profileFieldsSchemaReady,
  profileFieldsErrorMessage,
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
  const galleryPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const completion = getBusinessProfileCompletion(form, {
    includeOptionalProfileFields: profileFieldsSchemaReady,
  });
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
      body: JSON.stringify(
        profileFieldsSchemaReady
          ? form
          : {
              id: form.id,
              name: form.name,
              slug: form.slug,
              description: form.description,
              business_type: form.business_type,
              page_accent_color: form.page_accent_color,
              page_text_color: form.page_text_color,
              heading_font_size: form.heading_font_size,
              body_font_size: form.body_font_size,
            }
      ),
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
      phone: data.business?.phone ?? form.phone,
      email: data.business?.email ?? form.email,
      website: data.business?.website ?? form.website,
      address: data.business?.address ?? form.address,
      city: data.business?.city ?? form.city,
      state: data.business?.state ?? form.state,
      zip: data.business?.zip ?? form.zip,
      country: data.business?.country ?? form.country,
      social_facebook: data.business?.social_facebook ?? form.social_facebook,
      social_instagram: data.business?.social_instagram ?? form.social_instagram,
      social_twitter: data.business?.social_twitter ?? form.social_twitter,
      service_area: data.business?.service_area ?? form.service_area,
    };

    setForm(nextForm);
    setSavedCompletion(
      getBusinessProfileCompletion(nextForm, {
        includeOptionalProfileFields: profileFieldsSchemaReady,
      })
    );
    setSuccess("Business profile updated.");
    setLoading(false);
  }

  async function refreshGalleryImages(reason: string) {
    const res = await fetch(
      `/api/admin/business/gallery?businessId=${encodeURIComponent(form.id)}`,
      {
        method: "GET",
      }
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Gallery refresh failed.");
    }

    if (!Array.isArray(data.images)) {
      throw new Error("Gallery refresh did not return image rows.");
    }

    const refreshedImages = data.images as BusinessPageImage[];
    setGalleryImages(refreshedImages);
    console.log("[admin/customize] refreshed gallery rows", {
      businessId: form.id,
      reason,
      refreshedGalleryRowCount: refreshedImages.length,
    });

    return refreshedImages;
  }

  async function uploadGalleryPhotos(fileList: FileList | null) {
    const files = Array.from(fileList || []);
    console.log("[admin/customize] upload handler start", {
      businessId: form.id,
      fileCount: files.length,
    });
    console.log("[admin/customize] selected gallery file count", {
      businessId: form.id,
      selectedFileCount: files.length,
    });

    if (files.length === 0) {
      return;
    }

    if (galleryImages.length >= MAX_BUSINESS_GALLERY_IMAGES) {
      console.warn("[admin/customize] gallery upload blocked at image limit", {
        businessId: form.id,
        currentGalleryCount: galleryImages.length,
        selectedFileCount: files.length,
        maxGalleryImages: MAX_BUSINESS_GALLERY_IMAGES,
      });
      setUploadingPhoto(false);
      setSuccess(null);
      setError(GALLERY_LIMIT_MESSAGE);
      return;
    }

    if (galleryImages.length + files.length > MAX_BUSINESS_GALLERY_IMAGES) {
      const remainingSlots = MAX_BUSINESS_GALLERY_IMAGES - galleryImages.length;
      console.warn("[admin/customize] gallery upload blocked over image limit", {
        businessId: form.id,
        currentGalleryCount: galleryImages.length,
        selectedFileCount: files.length,
        remainingSlots,
        maxGalleryImages: MAX_BUSINESS_GALLERY_IMAGES,
      });
      setUploadingPhoto(false);
      setSuccess(null);
      setError(
        `${GALLERY_LIMIT_MESSAGE} You have ${remainingSlots} slot${
          remainingSlots === 1 ? "" : "s"
        } remaining.`
      );
      return;
    }

    const validationError = validateGalleryFilesBeforeUpload(files);
    if (validationError) {
      console.warn("[admin/customize] gallery upload blocked before request", {
        businessId: form.id,
        fileCount: files.length,
        validationError,
        maxOriginalSize: CLIENT_MAX_ORIGINAL_IMAGE_BYTES,
      });
      setUploadingPhoto(false);
      setSuccess(null);
      setError(validationError);
      return;
    }

    setUploadingPhoto(true);
    setError(null);
    setSuccess(null);

    let uploadSuccessCount = 0;
    let insertedRowCount = 0;

    try {
      for (const file of files) {
        const uploadFile = await compressGalleryImage(file);
        console.log("[admin/customize] gallery upload prepared file", {
          businessId: form.id,
          originalFileName: file.name,
          uploadFileName: uploadFile.name,
          originalSize: file.size,
          uploadSize: uploadFile.size,
          maxUploadSize: CLIENT_MAX_UPLOAD_IMAGE_BYTES,
        });

        const uploadForm = new FormData();
        uploadForm.set("businessId", form.id);
        uploadForm.set("file", uploadFile);
        const res = await fetch("/api/admin/business/gallery", {
          method: "POST",
          body: uploadForm,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            res.status === 413
              ? IMAGE_TOO_LARGE_MESSAGE
              : data.error || `Photo upload failed for ${file.name}.`
          );
        }

        if (!data.image?.id) {
          throw new Error(`Photo uploaded but no gallery row was returned for ${file.name}.`);
        }

        uploadSuccessCount += 1;
        insertedRowCount += 1;
        console.log("[admin/customize] gallery upload file complete", {
          businessId: form.id,
          fileName: file.name,
          uploadSuccessCount,
          insertedRowCount,
        });
      }

      const refreshedImages = await refreshGalleryImages("post-upload");
      console.log("[admin/customize] gallery upload final state", {
        businessId: form.id,
        selectedFileCount: files.length,
        uploadSuccessCount,
        insertedRowCount,
        refreshedGalleryRowCount: refreshedImages.length,
        finalGalleryStateLength: refreshedImages.length,
      });
      setSuccess(
        files.length === 1
          ? "Gallery photo added."
          : `${files.length} gallery photos added.`
      );
    } catch (err) {
      console.error("[admin/customize] gallery upload flow failed", {
        businessId: form.id,
        selectedFileCount: files.length,
        uploadSuccessCount,
        insertedRowCount,
        error: err instanceof Error ? err.message : "Photo upload failed.",
      });

      let message = err instanceof Error ? err.message : "Photo upload failed.";
      if (uploadSuccessCount > 0) {
        try {
          const refreshedImages = await refreshGalleryImages("post-upload-error");
          console.log("[admin/customize] gallery upload partial final state", {
            businessId: form.id,
            selectedFileCount: files.length,
            uploadSuccessCount,
            insertedRowCount,
            refreshedGalleryRowCount: refreshedImages.length,
            finalGalleryStateLength: refreshedImages.length,
          });
          message = `${message} ${uploadSuccessCount} uploaded photo${
            uploadSuccessCount === 1 ? "" : "s"
          } were refreshed in the gallery.`;
        } catch (refreshError) {
          message = `${message} Gallery refresh failed: ${
            refreshError instanceof Error ? refreshError.message : "Unknown refresh error."
          }`;
        }
      }
      setError(message);
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
        body: JSON.stringify({ businessId: form.id, imageId }),
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
      body: JSON.stringify({
        businessId: form.id,
        orderedIds: reordered.map((entry) => entry.id),
      }),
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
      body: JSON.stringify({ businessId: form.id, primaryImageId: imageId }),
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
    <div className="mx-auto max-w-6xl space-y-4 p-3 text-[var(--text-strong)] sm:p-4">
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
        <h1 className="font-heading text-2xl text-[var(--text-strong)]">Business Profile</h1>
        <p className="mt-1.5 text-sm text-[var(--text-soft)]">
          The preview uses the same compact public header, gallery, and information layout customers see.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-[var(--destructive)] bg-red-50 px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-[var(--success)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[410px_minmax(0,1fr)] lg:items-start">
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] lg:sticky lg:top-4">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Live preview
              </p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Public card layout</p>
            </div>
            <span className="rounded-md border border-[var(--success)] bg-[var(--success-bg)] px-2 py-1 text-xs text-[var(--success)]">
              Live
            </span>
          </div>
          <div
            className="overflow-hidden rounded-lg border border-[var(--border-soft)] p-2"
            style={{
              width: "100%",
              maxWidth: "384px",
            }}
          >
            <BusinessProfileShell
              businessName={form.name || "Business"}
              businessDescription={form.description}
              businessType={form.business_type}
              logoUrl={logoUrl}
              images={galleryImages}
              theme={previewTheme}
              platformBrand={platformBrand}
              compact
              contact={
                profileFieldsSchemaReady
                  ? {
                      phone: form.phone,
                      email: form.email,
                      website: form.website,
                      address: [form.address, [form.city, form.state, form.zip].filter(Boolean).join(", "), form.country]
                        .filter(Boolean)
                        .join("\n"),
                      serviceArea: form.service_area,
                      facebook: form.social_facebook,
                      instagram: form.social_instagram,
                      twitter: form.social_twitter,
                    }
                  : undefined
              }
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            planNotice.tone === "warning"
              ? "border-amber-200 bg-[var(--warning-bg)] text-[var(--warning)]"
              : "border-emerald-200 bg-[var(--success-bg)] text-[var(--success)]"
          }`}
        >
          {planNotice.message}
        </div>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-strong)]">Profile completion</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{completion.summary}</p>
            </div>
            <div className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1 text-sm font-medium text-[var(--text-strong)]">
              {completion.progressPercent}% complete
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border-soft)]">
            <div
              className="h-full rounded-full bg-[var(--success-bg)]0"
              style={{ width: `${completion.progressPercent}%` }}
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {completion.fields.map((field) => (
              <div
                key={field.key}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span className="font-medium text-[var(--text-strong)]">{field.label}</span>
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
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Saving incomplete changes will make the business profile no longer publish-ready.
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Business Info</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              These fields feed the compact public header and the detail block below the gallery.
            </p>
          </div>
          <div className="space-y-3">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Business name</p>
          <input
            placeholder="Business name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]"
          />
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Public slug</p>
          <input
            placeholder="public-business-slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]"
          />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Preview: /{publicRoutePrefix}/{slugPreview || "your-business"}
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Business description</p>
          <textarea
            placeholder="Describe what customers should know before they visit, book, order, or inquire."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="min-h-32 w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]"
          />
        </div>
          </div>
        </div>

        {profileFieldsSchemaReady ? (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Contact Info</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              These fields render on the public profile when present.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Phone</p>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Email</p>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Website</p>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Service area</p>
              <input value={form.service_area} onChange={(e) => setForm({ ...form, service_area: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div className="md:col-span-2">
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Street address</p>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">City</p>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">State</p>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">ZIP</p>
              <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Country</p>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Facebook</p>
              <input value={form.social_facebook} onChange={(e) => setForm({ ...form, social_facebook: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Instagram</p>
              <input value={form.social_instagram} onChange={(e) => setForm({ ...form, social_instagram: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Twitter/X</p>
              <input value={form.social_twitter} onChange={(e) => setForm({ ...form, social_twitter: e.target.value })} className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]" />
            </div>
          </div>
        </div>
        ) : profileFieldsErrorMessage ? (
          <div className="border p-3">
            Contact, location, and social fields are not available because the live database
            profile-field migration has not been applied.
          </div>
        ) : null}

        {customizationSchemaReady ? (
          <>
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Branding</h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                This logo appears in the compact public header.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-strong)]">
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
                className="rounded border border-[var(--destructive)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove logo
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Theme</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Colors and font sizes apply to the compact header and readable business details.
            </p>
          </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Page background/theme color</p>
            <input
              type="color"
              value={form.page_accent_color}
              onChange={(e) => setForm({ ...form, page_accent_color: e.target.value })}
              className="h-11 w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-1"
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              This saved theme color drives the public buttons, accents, and page background tint.
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Page text color</p>
            <input
              type="color"
              value={form.page_text_color}
              onChange={(e) => setForm({ ...form, page_text_color: e.target.value })}
              className="h-11 w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-1"
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Very low-contrast text colors are saved as the readable default.
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Heading font size</p>
            <input
              type="number"
              min="24"
              max="56"
              value={form.heading_font_size}
              onChange={(e) =>
                setForm({ ...form, heading_font_size: Number(e.target.value) })
              }
              className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]"
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Body font size</p>
            <input
              type="number"
              min="14"
              max="20"
              value={form.body_font_size}
              onChange={(e) =>
                setForm({ ...form, body_font_size: Number(e.target.value) })
              }
              className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface)] p-2 text-[var(--text-strong)]"
            />
          </div>
        </div>
        </div>

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Gallery</h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                Manage the compact framed public carousel without enlarging the control panel.
              </p>
            </div>
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => {
                console.log("[admin/customize] add photo clicked", {
                  businessId: form.id,
                  disabled: uploadingPhoto,
                });
                galleryPhotoInputRef.current?.click();
              }}
              className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingPhoto ? "Uploading..." : "Add photo"}
            </button>
            <input
              ref={galleryPhotoInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              disabled={uploadingPhoto}
              onChange={(event) => {
                const input = event.currentTarget;
                const files = input.files;
                console.log("FILE SELECTED", {
                  businessId: form.id,
                  fileCount: files?.length || 0,
                  files: Array.from(files || []).map((file) => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                  })),
                });
                void uploadGalleryPhotos(files).finally(() => {
                  input.value = "";
                });
              }}
              className="hidden"
            />
          </div>
          {customizationErrorMessage ? (
            <p className="mt-3 text-sm text-[var(--warning)]">{customizationErrorMessage}</p>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {galleryImages.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-5 text-sm text-[var(--text-muted)]">
                Upload photos to publish a gallery.
              </div>
            ) : (
              galleryImages.map((image, index) => (
                <div key={image.id} className="overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--surface)]">
                  <img src={image.image_url} alt={image.alt_text || "Business gallery photo"} className="aspect-square w-full object-cover" />
                  <div className="space-y-2 p-2 text-xs">
                    <span className="block font-medium text-[var(--text-soft)]">
                      {image.is_primary ? "Primary photo" : `Photo ${index + 1}`}
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      <button type="button" onClick={() => void markPrimaryPhoto(image.id)} className="rounded border border-[var(--border-soft)] px-2 py-1 text-[var(--text-soft)] disabled:opacity-50" disabled={image.is_primary}>Primary</button>
                      <button type="button" onClick={() => void moveGalleryPhoto(image.id, -1)} className="rounded border border-[var(--border-soft)] px-2 py-1 text-[var(--text-soft)] disabled:opacity-50" disabled={index === 0}>Up</button>
                      <button type="button" onClick={() => void moveGalleryPhoto(image.id, 1)} className="rounded border border-[var(--border-soft)] px-2 py-1 text-[var(--text-soft)] disabled:opacity-50" disabled={index === galleryImages.length - 1}>Down</button>
                      <button type="button" onClick={() => void removeGalleryPhoto(image.id)} className="rounded border border-[var(--destructive)] px-2 py-1 text-[var(--destructive)]">Remove</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
          </>
        ) : (
          <div className="border p-3">
            Branding, theme, and gallery controls are unavailable because the live database
            customization migration has not been applied.
          </div>
        )}

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Services / Products</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Manage sellable items in the dedicated operations modules so booking, ordering,
            checkout, and inventory rules remain connected to real records.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/admin/services" className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]">
              Services
            </a>
            <a href="/admin/products" className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]">
              Products / Menu
            </a>
            <a href="/admin/rentals" className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]">
              Rentals
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--section-bg)] p-3.5">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Public Actions</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Save changes, then open the real public pages that customers can use.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Profile"}
            </button>
            <a
              href={`/b/${slugPreview || form.slug || form.id}`}
              className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]"
            >
              Public profile
            </a>
            <a
              href={`/${publicRoutePrefix}/${slugPreview || form.slug || form.id}`}
              className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]"
            >
              Customer action page
            </a>
            <a
              href="/admin/settings"
              className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-strong)]"
            >
              Publish settings
            </a>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
