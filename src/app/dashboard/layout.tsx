import { ProductConfigRequiredState } from "@/components/product-config-required-state";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getDashboardAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getDashboardAccess();
  if (access.kind === "config_error") {
    return <ProductConfigRequiredState issues={access.issues} />;
  }

  return (
    <div className="flex flex-col h-dvh min-h-dvh overflow-hidden w-full">
      <div className="flex-1 relative min-h-0 md:grid md:grid-cols-[260px_minmax(0,1fr)] bg-dash-shell text-fresco-text font-sans overflow-hidden overscroll-none" id="dashboard-shell">
        <DashboardSidebar role={access.role} />
        <main className="min-w-0 h-full overflow-y-auto overscroll-none">{children}</main>
      </div>
    </div>
  );
}
