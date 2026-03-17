import { OnboardingFlow } from "@/components/onboarding-flow";
import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { getOnboardingAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const access = await getOnboardingAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <OnboardingFlow
      initialOnboardingState={access.onboardingState}
      initialOrganizationId={access.organizationId}
      initialSite={access.site}
      suggestedSiteName={access.suggestedSiteName}
    />
  );
}
