import { TenantWorkspace } from '@/features/tenants/tenant_workspace';
export default async function Page({ params }: { params: Promise<{ tenant_id: string; section?: string[] }> }) { const value = await params; return <TenantWorkspace tenant_id={value.tenant_id} section={value.section?.[0] ?? 'detail'} />; }
