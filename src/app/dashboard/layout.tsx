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
    <div className="md:grid md:grid-cols-[260px_minmax(0,1fr)] bg-[var(--framer-dashboard-shell-color)] text-[color:var(--framer-fresco-settingsText-color)] font-[var(--font-dashboard-ui),var(--font-sans),system-ui,-apple-system,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif] h-[calc(100dvh-var(--dashboard-banner-offset))] min-h-[calc(100dvh-var(--dashboard-banner-offset))] overflow-hidden pt-[var(--dashboard-banner-offset)] overscroll-none">
      <DashboardSidebar role={access.role} />
      <main className="min-w-0 h-[calc(100dvh-var(--dashboard-banner-offset))] overflow-y-auto overscroll-none">{children}</main>
    </div>
  );
}
