"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Business = {
  id: string;
  name: string | null;
  description?: string | null;
  refund_policy?: string | null;
  late_fee_disclosure?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  font_family?: string | null;
  font_color?: string | null;
  is_published?: boolean | null;
};

export default function SettingsClient({ business }: { business: Business }) {
  const supabase = createClient();

  const [name, setName] = useState(business.name || "");
  const [description, setDescription] = useState(business.description || "");
  const [refundPolicy, setRefundPolicy] = useState(business.refund_policy || "");
  const [lateFeeDisclosure, setLateFeeDisclosure] = useState(
    business.late_fee_disclosure || ""
  );
  const [logoUrl, setLogoUrl] = useState(business.logo_url || "");
  const [coverUrl, setCoverUrl] = useState(business.cover_image_url || "");
  const [fontFamily, setFontFamily] = useState(business.font_family || "");
  const [fontColor, setFontColor] = useState(business.font_color || "#ffffff");
  const [isPublished, setIsPublished] = useState(Boolean(business.is_published));

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewStyles = useMemo(
    () => ({
      fontFamily: fontFamily || "inherit",
      color: fontColor || "#ffffff",
    }),
    [fontFamily, fontColor]
  );

  const uploadImage = async (
    file: File,
    target: "logo" | "cover"
  ) => {
    setError(null);
    setMessage(null);

    if (!file) return;

if (file.size > 3 * 1024 * 1024) {
  setError("Image must be under 3MB.");
  return;
}
    if (target === "logo") {
      setUploadingLogo(true);
    } else {
      setUploadingCover(true);
    }

    const path = `${business.id}/${target}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("business-assets")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploadingLogo(false);
      setUploadingCover(false);
      return;
    }

    const { data } = supabase.storage
      .from("business-assets")
      .getPublicUrl(path);

    if (target === "logo") {
      setLogoUrl(data.publicUrl);
      setUploadingLogo(false);
    } else {
      setCoverUrl(data.publicUrl);
      setUploadingCover(false);
    }

    setMessage("Image uploaded.");
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    const res = await fetch("/api/business/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        refund_policy: refundPolicy,
        late_fee_disclosure: lateFeeDisclosure,
        logo_url: logoUrl,
        cover_image_url: coverUrl,
        font_family: fontFamily,
        font_color: fontColor,
        is_published: isPublished,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data?.error || "Failed to update settings.");
      setSaving(false);
      return;
    }

    setMessage("Settings saved successfully.");
    setSaving(false);
  };

  return (
    <div className="text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Business Settings</h1>
        <p className="text-sm text-gray-400">
          Customize how your business appears to customers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSave}
          className="lg:col-span-2 bg-zinc-900/70 border border-white/10 rounded-xl p-6 space-y-5"
        >
          <div>
            <label className="block text-sm text-gray-300 mb-2">Business Name</label>
            <input
              className="w-full border border-white/10 bg-black/40 p-2 rounded-md text-white outline-none focus:ring-2 focus:ring-purple-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Description</label>
            <textarea
              className="w-full border border-white/10 bg-black/40 p-2 rounded-md text-white outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Refund Policy</label>
            <textarea
              className="w-full border border-white/10 bg-black/40 p-2 rounded-md text-white outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px]"
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
              placeholder="Describe cancellation, refund timing, and non-refundable charges."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Late Fee Disclosure
            </label>
            <textarea
              className="w-full border border-white/10 bg-black/40 p-2 rounded-md text-white outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px]"
              value={lateFeeDisclosure}
              onChange={(e) => setLateFeeDisclosure(e.target.value)}
              placeholder="For rental or property businesses, disclose any late, overstay, holdover, cleaning, or similar fees."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Font Family</label>
              <input
                className="w-full border border-white/10 bg-black/40 p-2 rounded-md text-white outline-none focus:ring-2 focus:ring-purple-500"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                placeholder="Inter, sans-serif"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Font Color</label>
              <input
                type="color"
                className="w-full h-10 border border-white/10 bg-black/40 p-1 rounded-md"
                value={fontColor}
                onChange={(e) => setFontColor(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="published"
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40"
            />
            <label htmlFor="published" className="text-sm text-gray-300">
              Published and visible on the public booking page
            </label>
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {message && <div className="text-sm text-green-400">{message}</div>}

          <button
            type="submit"
            className="bg-purple-600 px-4 py-2 rounded-md hover:bg-purple-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <div className="space-y-6">
          <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Logo</h2>
            <div className="w-24 h-24 rounded-xl bg-black/40 border border-white/10 overflow-hidden mb-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  No logo
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, "logo");
              }}
              disabled={uploadingLogo}
              className="text-sm"
            />
            {uploadingLogo && <p className="text-xs text-gray-400 mt-2">Uploading...</p>}
          </div>

          <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Cover Image</h2>
            <div className="w-full h-32 rounded-xl bg-black/40 border border-white/10 overflow-hidden mb-3">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  No cover
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, "cover");
              }}
              disabled={uploadingCover}
              className="text-sm"
            />
            {uploadingCover && <p className="text-xs text-gray-400 mt-2">Uploading...</p>}
          </div>

          <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-3">Preview</h2>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4" style={previewStyles}>
              <p className="text-sm">{name || "Business Name"}</p>
              <p className="text-xs opacity-70">
                {description || "Add a description to introduce your business."}
              </p>
              {refundPolicy ? (
                <p className="mt-3 text-xs opacity-70">
                  Refund policy: {refundPolicy}
                </p>
              ) : null}
              {lateFeeDisclosure ? (
                <p className="mt-2 text-xs opacity-70">
                  Late fee disclosure: {lateFeeDisclosure}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
