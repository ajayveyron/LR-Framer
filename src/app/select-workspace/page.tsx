import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { WorkspaceSelector } from "@/components/workspace-selector";
import { getProductEnvIssues } from "@/lib/product-env";

export const dynamic = "force-dynamic";

export default async function SelectWorkspacePage() {
  const issues = getProductEnvIssues();
  if (issues.length > 0) {
    return <ProductConfigRequiredState issues={issues} />;
  }

  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-y-auto overscroll-none bg-[var(--background)] p-4 sm:p-7 grid place-items-center">
      <WorkspaceSelector />
    </main>
  );
}
