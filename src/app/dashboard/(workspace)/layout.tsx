import { WorkspaceSettingsLayout } from "@/components/workspace-settings-layout";

export default function DashboardWorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <WorkspaceSettingsLayout>{children}</WorkspaceSettingsLayout>;
}
