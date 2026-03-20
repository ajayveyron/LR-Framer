import { SignUp } from "@clerk/nextjs";

import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { getProductEnvIssues } from "@/lib/product-env";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const issues = getProductEnvIssues();
  if (issues.length > 0) {
    return <ProductConfigRequiredState issues={issues} />;
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-y-auto overscroll-none bg-[var(--background)] p-4 sm:p-7 grid place-items-center">
      <SignUp forceRedirectUrl="/onboarding" path="/sign-up" />
    </main>
  );
}
