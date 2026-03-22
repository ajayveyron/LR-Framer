"use client";

import Image from "next/image";

type BrandLogoProps = {
  /** Height in pixels — width scales proportionally */
  height?: number;
  className?: string;
};

/**
 * Environment-aware brand logo.
 * Uses dev logo in development, prod logo in production.
 * Rendered via inline script to avoid hydration mismatch with NODE_ENV.
 */
export function BrandLogo({ height = 28, className }: BrandLogoProps) {
  const isDev = process.env.NODE_ENV === "development";
  const src = isDev ? "/logo-dev.png" : "/logo.png";
  const alt = "Framer Bot";

  return (
    <Image
      alt={alt}
      className={className}
      draggable={false}
      height={height}
      priority
      src={src}
      style={{ width: "auto", height }}
      width={height * 4}
    />
  );
}
