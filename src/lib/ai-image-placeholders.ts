export const IMAGE_JOB_PLACEHOLDER_PREFIX = "__image_job__:";

export function buildImageJobPlaceholder(jobId: string) {
  return `${IMAGE_JOB_PLACEHOLDER_PREFIX}${jobId}`;
}

export function extractImageJobId(value: unknown) {
  if (typeof value !== "string") return null;
  if (!value.startsWith(IMAGE_JOB_PLACEHOLDER_PREFIX)) return null;
  const jobId = value.slice(IMAGE_JOB_PLACEHOLDER_PREFIX.length).trim();
  return jobId.length > 0 ? jobId : null;
}
