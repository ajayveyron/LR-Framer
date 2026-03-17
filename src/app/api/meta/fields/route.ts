import { NextResponse } from "next/server";

import { getErrorResponse } from "@/lib/api";
import { getBlogMetadata } from "@/lib/framer";
import { runWithCurrentSiteFramerContext } from "@/lib/product-framer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const metadata = await runWithCurrentSiteFramerContext(() => getBlogMetadata());
    return NextResponse.json(metadata);
  } catch (error) {
    const mapped = getErrorResponse(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
