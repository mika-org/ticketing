import { DashboardShell } from '@/components/dashboard_shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell scope="admin">{children}</DashboardShell>;
}
