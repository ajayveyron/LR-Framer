import { DashboardTableView } from "@/components/dashboard-table-view";
import { ConfigRequiredState } from "@/components/config-required-state";
import { NotificationProvider } from "@/components/notification-provider";
import { getDefaultColumns } from "@/lib/dashboard-columns";
import { getServerEnvIssues } from "@/lib/env";
import { getDashboardOverview } from "@/lib/framer";
import { getNotionBridgeStatus } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const DASHBOARD_PRELOAD_LIMIT = 20;

export default async function DashboardLayout({
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envIssues = getServerEnvIssues();

  if (envIssues.length > 0) {
    return (
      <NotificationProvider>
        <main className="shell">
          <ConfigRequiredState issues={envIssues} />
        </main>
      </NotificationProvider>
    );
  }

  const { metadata, posts } = await getDashboardOverview(DASHBOARD_PRELOAD_LIMIT);
  const bridgeStatus = getNotionBridgeStatus();

  return (
    <NotificationProvider>
      <main className="shell">
        <DashboardTableView
          bridgeStatus={bridgeStatus}
          initialColumns={getDefaultColumns(metadata)}
          metadata={metadata}
          posts={posts}
        />
      </main>
    </NotificationProvider>
  );
}
