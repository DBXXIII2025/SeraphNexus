"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type PlatformBrandRenderState = "missing" | "loading" | "loaded" | "error";

export default function PlatformBrandMark({
  src,
  alt,
  fallback,
  logScope,
  imgClassName = "",
  fallbackClassName = "",
  onRenderStateChange,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
  logScope: string;
  imgClassName?: string;
  fallbackClassName?: string;
  onRenderStateChange?: (state: PlatformBrandRenderState) => void;
}) {
  const [renderState, setRenderState] = useState<PlatformBrandRenderState>(
    src ? "loading" : "missing"
  );

  useEffect(() => {
    const nextState = src ? "loading" : "missing";
    setRenderState(nextState);
    onRenderStateChange?.(nextState);

    console.info(`[platform-branding] ${logScope} render decision`, {
      logoUrl: src || null,
      renderDecision: src ? "logo-pending" : "fallback",
      renderState: nextState,
    });
  }, [logScope, onRenderStateChange, src]);

  if (!src || renderState === "error") {
    return <span className={fallbackClassName}>{fallback}</span>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={96}
      height={96}
      unoptimized
      className={imgClassName}
      onLoad={() => {
        console.info(`[platform-branding] ${logScope} image loaded`, {
          logoUrl: src,
        });
        setRenderState("loaded");
        onRenderStateChange?.("loaded");
      }}
      onError={() => {
        console.error(`[platform-branding] ${logScope} image failed`, {
          logoUrl: src,
        });
        setRenderState("error");
        onRenderStateChange?.("error");
      }}
    />
  );
}
