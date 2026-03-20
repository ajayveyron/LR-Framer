import { NextResponse } from "next/server";

import { createErrorJsonResponse } from "@/lib/api";
import { logError } from "@/lib/logger";
import { requireDashboardApiAccess } from "@/lib/product-access";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await requireDashboardApiAccess();

    return NextResponse.json(
      {
        canManage: access.role === "admin",
        initialCollectionId: access.site.framerCollectionId ?? "",
        initialCollectionName: access.site.framerCollectionName ?? "",
        initialProjectInput:
          access.site.framerProjectUrl ?? access.site.framerProjectId ?? "",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    logError("product.settings.view.failed", error);
    return createErrorJsonResponse(error);
  }
}
