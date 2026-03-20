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
    <div className="dashboard-shell overscroll-none">
      <DashboardSidebar role={access.role} />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
