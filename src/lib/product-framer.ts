import { AppError } from "@/lib/errors";
import { runWithFramerRuntimeContext } from "@/lib/framer-runtime";
import { getDashboardAccess, getSiteFramerRuntimeContext } from "@/lib/product-access";

export async function runWithCurrentSiteFramerContext<T>(
  callback: () => Promise<T>,
) {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    throw new AppError(
      "FramerLink is missing required product environment variables.",
      503,
      { fieldErrors: access.issues },
    );
  }

  return runWithFramerRuntimeContext(
    getSiteFramerRuntimeContext(access.site),
    callback,
  );
}
