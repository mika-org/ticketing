import { DashboardShell } from '@/components/dashboard_shell';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell scope="super_admin">{children}</DashboardShell>;
}
