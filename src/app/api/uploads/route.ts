import { NextResponse } from "next/server";

import { createErrorJsonResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { logError, logEvent } from "@/lib/logger";
import { uploadBlogAsset } from "@/lib/framer-core";
import { runWithCurrentSiteFramerContext } from "@/lib/product-framer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = formData.get("kind");

    if (!(file instanceof File)) {
      throw new AppError("A file is required.", 400);
    }

    if (kind !== "image" && kind !== "file") {
      throw new AppError("Upload kind must be \"image\" or \"file\".", 400);
    }

    const asset = await runWithCurrentSiteFramerContext(() =>
      uploadBlogAsset(kind, file),
    );

    logEvent("info", "api.upload.succeeded", {
      kind,
      name: file.name,
      size: file.size,
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    logError("api.upload.failed", error);
    return createErrorJsonResponse(error);
  }
}
