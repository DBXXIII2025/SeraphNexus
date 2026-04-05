"use client";

import { useRef, useState } from "react";

type BusinessLogoManagerProps = {
  businessId: string;
  businessName: string;
  initialLogoUrl: string | null;
  isConfigured: boolean;
  configurationMessage?: string | null;
  lockedMessage?: string | null;
};

type RouteResponse = {
  error?: string;
  logoUrl?: string | null;
  logoStoragePath?: string | null;
};

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "BN";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "BN";
}

export default function BusinessLogoManager({
  businessId,
  businessName,
  initialLogoUrl,
  isConfigured,
  configurationMessage,
  lockedMessage,
}: BusinessLogoManagerProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initials = getInitials(businessName || "Business");

  async function parseResponse(res: Response) {
    const data = (await res.json().catch(() => ({}))) as RouteResponse;
    if (!res.ok) {
      throw new Error(data.error || "Business logo update failed");
    }
    return data;
  }

  async function uploadLogo(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !isConfigured || lockedMessage) {
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const file = fileList[0];
      const formData = new FormData();
      formData.set("businessId", businessId);
      formData.set("file", file);

      const res = await fetch("/api/admin/business/logo", {
        method: "POST",
        body: formData,
      });

      const data = await parseResponse(res);
      setLogoUrl(data.logoUrl || null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload business logo");
    } finally {
      setIsWorking(false);
    }
  }

  async function removeLogo() {
    if (!isConfigured || !logoUrl || lockedMessage) {
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/business/logo", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId }),
      });

      await parseResponse(res);
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove business logo");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.5),rgba(9,9,11,0.88))] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(24,24,27,0.92))] shadow-inner">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold tracking-[0.16em] text-gray-200">
                {initials}
              </span>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Business logo</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{businessName}</h3>
            <p className="mt-1 max-w-xl text-sm text-gray-300">
              Use a compact, clean mark that reads well in admin identity blocks and public headers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <label
            className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium transition ${
              isConfigured
                ? lockedMessage
                  ? "cursor-not-allowed border-white/10 bg-black/20 text-gray-500"
                  : "cursor-pointer border-white/10 bg-white/5 text-white hover:bg-white/10"
                : "cursor-not-allowed border-white/10 bg-black/20 text-gray-500"
            }`}
          >
            {logoUrl ? "Replace logo" : "Upload logo"}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={!isConfigured || Boolean(lockedMessage) || isWorking}
              onChange={(event) => void uploadLogo(event.target.files)}
            />
          </label>

          <button
            type="button"
            onClick={() => void removeLogo()}
            disabled={!isConfigured || !logoUrl || Boolean(lockedMessage) || isWorking}
            className="rounded-md border border-red-500/20 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove logo
          </button>
        </div>
      </div>

      {configurationMessage ? (
        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          {configurationMessage}
        </div>
      ) : null}

      {lockedMessage ? (
        <div className="mt-4 rounded-xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm text-[var(--accent-gold-soft)]">
          {lockedMessage}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 grid gap-3 text-xs text-gray-400 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          Recommended format: square or near-square mark
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          Accepted types: JPG, PNG, WEBP
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          Max file size: 2 MB
        </div>
      </div>
    </div>
  );
}
