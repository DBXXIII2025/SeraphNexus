"use client";

import { useRef, useState } from "react";
import type { ServiceImageRecord } from "@/lib/serviceImages";

type ServiceImagesManagerProps = {
  businessId: string;
  serviceId: string;
  serviceName: string;
  initialImages: ServiceImageRecord[];
};

type RouteResponse = {
  error?: string;
  image?: ServiceImageRecord;
  images?: ServiceImageRecord[];
};

function sortImages(images: ServiceImageRecord[]) {
  return [...images].sort((a, b) => {
    const primaryDiff = Number(b.is_primary === true) - Number(a.is_primary === true);
    if (primaryDiff !== 0) {
      return primaryDiff;
    }

    return Number(a.sort_order || 0) - Number(b.sort_order || 0);
  });
}

export default function ServiceImagesManager({
  businessId,
  serviceId,
  serviceName,
  initialImages,
}: ServiceImagesManagerProps) {
  const [images, setImages] = useState<ServiceImageRecord[]>(sortImages(initialImages));
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function parseResponse(res: Response) {
    const data = (await res.json().catch(() => ({}))) as RouteResponse;
    if (!res.ok) {
      throw new Error(data.error || "Service image action failed");
    }
    return data;
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      let nextImages = [...images];

      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.set("businessId", businessId);
        formData.set("serviceId", serviceId);
        formData.set("file", file);

        const res = await fetch("/api/services/images", {
          method: "POST",
          body: formData,
        });

        const data = await parseResponse(res);
        if (data.image) {
          nextImages = sortImages([...nextImages, data.image]);
        }
      }

      setImages(nextImages);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload service image");
    } finally {
      setIsWorking(false);
    }
  }

  async function runJsonAction(body: Record<string, unknown>) {
    setIsWorking(true);
    setError(null);

    try {
      const method = body.action === "delete" ? "DELETE" : "PATCH";
      const res = await fetch("/api/services/images", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await parseResponse(res);
      if (data.images) {
        setImages(sortImages(data.images));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service image");
    } finally {
      setIsWorking(false);
    }
  }

  async function setPrimary(imageId: string) {
    await runJsonAction({
      action: "set-primary",
      businessId,
      serviceId,
      imageId,
    });
  }

  async function deleteImage(imageId: string) {
    await runJsonAction({
      action: "delete",
      businessId,
      serviceId,
      imageId,
    });
  }

  async function moveImage(imageId: string, direction: -1 | 1) {
    const orderedIds = images.map((image) => image.id);
    const index = orderedIds.findIndex((id) => id === imageId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) {
      return;
    }

    const swapped = [...orderedIds];
    const current = swapped[index];
    swapped[index] = swapped[nextIndex];
    swapped[nextIndex] = current;

    await runJsonAction({
      action: "reorder",
      businessId,
      serviceId,
      orderedImageIds: swapped,
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Service Images</p>
          <p className="mt-1 max-w-2xl text-sm text-gray-300">
            Organize compact service visuals for {serviceName}. The primary image leads public cards, while extras stay tucked into the gallery.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10">
          Upload images
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => void uploadFiles(event.target.files)}
            disabled={isWorking}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      {images.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(24,24,27,0.7))] p-4 text-sm text-gray-400">
          <p className="font-medium text-gray-200">No service visuals yet</p>
          <p className="mt-2 leading-6">
            Add a compact square or landscape image to give this service a polished preview without overpowering the booking flow.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.55),rgba(9,9,11,0.92))] p-3"
            >
              <div className="relative aspect-[1.05/1] overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-inner">
                {image.image_url ? (
                  <img
                    src={image.image_url}
                    alt={image.alt_text || `${serviceName} image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-medium uppercase tracking-[0.22em] text-gray-500">
                    Placeholder
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    image.is_primary
                      ? "border border-emerald-500/20 bg-emerald-500/12 text-emerald-200"
                      : "border border-white/10 bg-white/5 text-gray-300"
                  }`}
                >
                  {image.is_primary ? "Primary" : `Image ${index + 1}`}
                </span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                  Slot {index + 1}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => void setPrimary(image.id)}
                  className="rounded-md border border-white/10 px-2 py-2 text-white transition hover:bg-white/5 disabled:opacity-50"
                  disabled={isWorking || image.is_primary === true}
                >
                  Make primary
                </button>
                <button
                  type="button"
                  onClick={() => void deleteImage(image.id)}
                  className="rounded-md border border-red-500/20 px-2 py-2 text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                  disabled={isWorking}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => void moveImage(image.id, -1)}
                  className="rounded-md border border-white/10 px-2 py-2 text-white transition hover:bg-white/5 disabled:opacity-50"
                  disabled={isWorking || index === 0}
                >
                  Move left
                </button>
                <button
                  type="button"
                  onClick={() => void moveImage(image.id, 1)}
                  className="rounded-md border border-white/10 px-2 py-2 text-white transition hover:bg-white/5 disabled:opacity-50"
                  disabled={isWorking || index === images.length - 1}
                >
                  Move right
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
