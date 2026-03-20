export function formatErrorMessage(message: string) {
  try {
    const parsed = JSON.parse(message) as Array<{
      message?: string;
      path?: Array<string | number>;
    }>;

    if (Array.isArray(parsed)) {
      return parsed
        .map((issue) => {
          const path = issue.path?.join(".") ?? "error";
          return `${path}: ${issue.message ?? "Invalid value"}`;
        })
        .join("\n");
    }
  } catch {}

  return message;
}
