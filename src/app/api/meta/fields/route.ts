import { NextResponse } from "next/server";

import { createErrorJsonResponse } from "@/lib/api";
import { getBlogMetadata } from "@/lib/framer";
import { runWithCurrentSiteFramerContext } from "@/lib/product-framer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const metadata = await runWithCurrentSiteFramerContext(request, () => getBlogMetadata());
    return NextResponse.json(metadata);
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}
