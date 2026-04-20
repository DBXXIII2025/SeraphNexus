"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PlatformBrandingPanelProps = {
  siteName: string;
  logoUrl: string | null;
  hasStoredLogo: boolean;
  maxLogoBytes: number;
};

type BrandingResponse = {
  ok?: boolean;
  code?: string;
  logoUrl?: string | null;
  updatedAt?: string;
};

function getStatusMessage(code: string | null, maxLogoBytes: number) {
  if (!code) {
    return null;
  }

  const messages: Record<string, string> = {
    "platform-logo-updated": "Platform logo updated.",
    "platform-logo-cleared": "Platform logo cleared.",
    "platform-logo-required": "Choose a logo file before uploading.",
    "platform-logo-type-invalid": "Only JPG, PNG, WEBP, and SVG platform logos are allowed.",
    "platform-logo-too-large": `Platform logos must be ${Math.round(maxLogoBytes / 1024 / 1024)} MB or smaller.`,
    "platform-logo-upload-failed": "The logo file could not be uploaded.",
    "platform-branding-settings-unavailable": "Platform branding settings could not be loaded.",
    "platform-branding-migration-required":
      "Platform branding data is not ready. Apply the platform branding migration first.",
    "platform-branding-storage-unavailable":
      "Platform branding storage bucket is unavailable. Check the platform-branding bucket setup.",
    "platform-branding-save-failed": "Platform branding could not be updated.",
    "platform-logo-update-failed": "Platform branding could not be updated.",
    forbidden: "Platform admin access is required.",
  };

  return messages[code] || "Platform branding could not be updated.";
}

function withCacheBuster(logoUrl: string | null, updatedAt?: string) {
  if (!logoUrl) {
    return null;
  }

  const version = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  const separator = logoUrl.includes("?") ? "&" : "?";
  return `${logoUrl}${separator}v=${Number.isFinite(version) ? version : Date.now()}`;
}

export default function PlatformBrandingPanel({
  siteName,
  logoUrl,
  hasStoredLogo,
  maxLogoBytes,
}: PlatformBrandingPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl);
  const [logoIsStored, setLogoIsStored] = useState(hasStoredLogo);
  const [statusCode, setStatusCode] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const statusMessage = useMemo(
    () => getStatusMessage(statusCode, maxLogoBytes),
    [maxLogoBytes, statusCode]
  );

  async function submitBranding(action: "upload" | "clear") {
    if (isSaving) {
      return;
    }

    const formData = new FormData();
    formData.set("_action", action);

    if (action === "upload") {
      const file = fileInputRef.current?.files?.[0] || null;
      if (!file) {
        setStatusTone("error");
        setStatusCode("platform-logo-required");
        return;
      }
      formData.set("logo", file);
    }

    setIsSaving(true);
    setStatusTone(null);
    setStatusCode(null);

    try {
      const response = await fetch("/api/admin/platform/branding", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "platform-branding-client",
        },
        body: formData,
      });
      const payload = (await response.json()) as BrandingResponse;

      if (!response.ok || !payload.ok) {
        setStatusTone("error");
        setStatusCode(payload.code || "platform-logo-update-failed");
        return;
      }

      const nextLogoUrl = withCacheBuster(payload.logoUrl ?? null, payload.updatedAt);
      setCurrentLogoUrl(nextLogoUrl);
      setLogoIsStored(Boolean(payload.logoUrl));
      setStatusTone("success");
      setStatusCode(payload.code || "platform-logo-updated");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
    } catch (error) {
      console.error("[platform-branding-client] upload failed", error);
      setStatusTone("error");
      setStatusCode("platform-logo-update-failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="premium-card p-6">
      <div className="section-header-copy">
        <p className="section-kicker">Platform Branding</p>
        <h2 className="section-title">Global site logo</h2>
        <p className="section-description">
          Manage the official platform mark shown in public headers next to {siteName}.
        </p>
      </div>

      <div className="mt-5 table-row-panel p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--surface-raised)] p-2">
            {currentLogoUrl ? (
              <img
                src={currentLogoUrl}
                alt={`${siteName} logo`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent-soft)]">
                SN
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[var(--text-strong)]">{siteName}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {logoIsStored
                ? "Custom platform logo is active."
                : "No custom logo uploaded. Headers use the fallback mark."}
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Stored on the existing platform_settings row.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="text-sm text-[var(--text-soft)]">
          <span className="form-label">Replace logo</span>
          <input
            ref={fileInputRef}
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="input-field mt-2"
            disabled={isSaving}
          />
        </label>
        <p className="text-xs text-[var(--text-muted)]">
          Upload a JPG, PNG, WEBP, or SVG logo up to {Math.round(maxLogoBytes / 1024 / 1024)} MB.
          New files use unique storage paths and header URLs are versioned from the settings
          timestamp.
        </p>
        {statusMessage ? (
          <div
            className={`surface-panel px-4 py-3 text-sm ${
              statusTone === "success"
                ? "border-emerald-500/30 text-emerald-200"
                : "border-red-500/30 text-red-200"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => submitBranding("upload")}
            disabled={isSaving}
            className="btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Upload platform logo"}
          </button>
          {logoIsStored ? (
            <button
              type="button"
              onClick={() => submitBranding("clear")}
              disabled={isSaving}
              className="btn-secondary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear logo
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
