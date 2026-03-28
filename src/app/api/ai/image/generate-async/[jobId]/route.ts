import { NextResponse } from "next/server";

import { getImageJob } from "@/lib/ai-image-jobs";
import { requireDashboardApiAccess } from "@/lib/product-access";
import { createErrorJsonResponse } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Poll endpoint for background image generation jobs.
 * Returns the current job status, and the image URL once completed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireDashboardApiAccess();
    const { jobId } = await params;
    const job = getImageJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      url: job.url,
      thumbnailUrl: job.thumbnailUrl,
      mimeType: job.mimeType,
      error: job.error,
      prompt: job.prompt,
      appliedTargetCount: job.appliedTargetCount ?? 0,
    });
  } catch (error) {
    return createErrorJsonResponse(error);
  }
}
