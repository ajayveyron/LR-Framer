import { SignIn } from "@clerk/nextjs";

import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { getProductEnvIssues } from "@/lib/product-env";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const issues = getProductEnvIssues();
  if (issues.length > 0) {
    return <ProductConfigRequiredState issues={issues} />;
  }

  return (
    <main className="framer-shell grid place-items-center">
      <SignIn fallbackRedirectUrl="/dashboard" path="/sign-in" />
    </main>
  );
}
