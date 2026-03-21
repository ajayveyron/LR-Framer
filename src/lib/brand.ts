import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { BrandContext } from "@/lib/ai-image-prompt";
import { buildImageSystemPrompt } from "@/lib/ai-image-prompt";

let cachedBrand: BrandContext | null = null;

/**
 * Loads brand context from `brand.json` in the project root.
 * Returns an empty object if the file doesn't exist or can't be parsed.
 * Result is cached after first successful read.
 */
export async function loadBrandContext(): Promise<BrandContext> {
  if (cachedBrand) return cachedBrand;

  try {
    const raw = await readFile(join(process.cwd(), "brand.json"), "utf-8");
    const data = JSON.parse(raw);
    cachedBrand = {
      name: data?.brand ?? undefined,
      aesthetic: data?.aesthetic ?? undefined,
      primaryColor: data?.designTokens?.colors?.brand?.primary ?? undefined,
    };
  } catch {
    cachedBrand = {};
  }

  return cachedBrand;
}

/**
 * Loads brand.json and returns the full image system prompt with brand
 * context injected. Use this in API routes / tools instead of the static export.
 */
export async function getImageSystemPrompt(): Promise<string> {
  const brand = await loadBrandContext();
  return buildImageSystemPrompt(brand);
}
