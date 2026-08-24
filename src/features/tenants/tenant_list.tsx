'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { api_client } from '@/lib/api_client';

type Tenant = { id: string; name: string; slug: string; email: string | null; status: string; primaryColor: string | null; _count: { users: number; events: number; registrations: number } };

export function TenantList() {
  const [search, set_search] = useState('');
  const router = useRouter();
  const query = useQuery({ queryKey: ['tenants', search], queryFn: () => api_client<{ tenants: Tenant[] }>(`/tenants?search=${encodeURIComponent(search)}`) });
  const select = useMutation({
    mutationFn: (tenant_id: string) => api_client('/auth/tenant-context', { method: 'POST', body: JSON.stringify({ tenant_id }) }),
    onSuccess: () => { toast.success('Konteks tenant aktif'); router.push('/admin/dashboard'); router.refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Tenant" description="Kelola organisasi, akun, event, dan konfigurasi pembayaran dari satu daftar." action={<Link href="/super-admin/tenants/new" className="button-primary"><Plus className="size-4" />Tenant baru</Link>} />
      <div className="surface mb-5 flex items-center gap-3 p-3"><Search className="ml-2 size-4 text-stone-400" /><input value={search} onChange={(event) => set_search(event.target.value)} className="w-full border-0 bg-transparent text-sm focus:ring-0" placeholder="Cari nama atau slug tenant..." /></div>
      {query.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((key) => <Skeleton key={key} className="h-52" />)}</div> : null}
      {!query.isLoading && !query.data?.data.tenants.length ? <EmptyState title="Belum ada tenant" description="Buat tenant pertama sekaligus akun Admin Tenant yang akan mengelolanya." action={<Link href="/super-admin/tenants/new" className="button-primary">Buat tenant</Link>} /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data?.data.tenants.map((tenant) => <article key={tenant.id} className="surface group p-5 transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-xl text-white" style={{ backgroundColor: tenant.primaryColor ?? '#17211b' }}><Building2 className="size-5" /></div><StatusBadge status={tenant.status} /></div><h2 className="mt-6 text-lg font-bold">{tenant.name}</h2><p className="mt-1 font-mono text-xs text-stone-400">/{tenant.slug}</p><div className="mt-5 flex gap-4 border-y border-stone-100 py-3 text-xs text-stone-500"><span>{tenant._count.events} event</span><span>{tenant._count.users} user</span><span>{tenant._count.registrations} daftar</span></div><div className="mt-4 flex gap-2"><Link href={`/super-admin/tenants/${tenant.id}`} className="button-secondary flex-1">Detail</Link><button onClick={() => select.mutate(tenant.id)} disabled={select.isPending} className="button-primary flex-1">Kelola <ArrowRight className="size-4" /></button></div></article>)}</div>
    </div>
  );
}
