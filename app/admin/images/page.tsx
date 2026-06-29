"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminImagesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadImages = useCallback(async () => {
    const { data, error } = await supabase.storage
      .from("property-images")
      .list("", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("LIST ERROR:", error);
      return;
    }

    if (!data) return;

    const urls = data.map((file) => {
      const { data: urlData } = supabase.storage
        .from("property-images")
        .getPublicUrl(file.name);

      return urlData.publicUrl;
    });

    setImages(urls);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error || profile?.role !== "owner") {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      await loadImages();
      setLoading(false);
    }

    init();
  }, [loadImages, router, supabase]);

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const filePath = `${Date.now()}-${file.name}`;

    setUploading(true);

    const { data, error } = await supabase.storage
      .from("property-images")
      .upload(filePath, file);

    setUploading(false);

    if (error) {
      console.error("UPLOAD ERROR:", error);
      alert(`Upload failed: ${error.message}`);
      return;
    }

    if (data) {
      await loadImages();
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)] flex items-center justify-center">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)] p-10">
      <h1 className="text-2xl font-semibold mb-6">Property Images</h1>

      <label className="inline-block mb-6">
        <span className="bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-3 rounded cursor-pointer font-semibold">
          {uploading ? "Uploading..." : "Upload New Image"}
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={uploadImage}
          className="hidden"
          disabled={uploading}
        />
      </label>

      {images.length === 0 && (
        <p className="opacity-70">No images uploaded yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {images.map((url) => (
          <div
            key={url}
            className="relative w-full h-56 rounded-xl overflow-hidden border border-zinc-700"
          >
            <Image
              src={url}
              alt="Property"
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
      </div>
    </main>
  );
}
