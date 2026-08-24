'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button, Field, PageHeader } from '@/components/ui';
import { api_client, ApiClientError } from '@/lib/api_client';
import { tenant_schema } from '@/lib/validation';

type Values = z.input<typeof tenant_schema>;

export function TenantForm() {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(tenant_schema), defaultValues: { name: '', slug: '', primary_color: '#4c7a54', admin_full_name: '', admin_email: '', admin_password: '' } });
  async function submit(values: Values) {
    try {
      const response = await api_client<{ tenant: { id: string } }>('/tenants', { method: 'POST', body: JSON.stringify(values) });
      toast.success('Tenant dan Admin Tenant berhasil dibuat');
      router.push(`/super-admin/tenants/${response.data.tenant.id}`);
    } catch (error) { toast.error(error instanceof ApiClientError ? error.message : 'Gagal membuat tenant'); }
  }
  return (
    <div>
      <PageHeader eyebrow="Tenant baru" title="Siapkan ruang kerja baru." description="Tenant dibuat bersama satu akun Admin Tenant agar operasional dapat langsung dimulai." action={<Link href="/super-admin/tenants" className="button-secondary"><ArrowLeft className="size-4" />Kembali</Link>} />
      <form onSubmit={form.handleSubmit(submit)} className="grid gap-6 xl:grid-cols-[1fr_.72fr]" noValidate>
        <section className="surface p-6"><div className="mb-6 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-moss-50 text-moss-700"><Building2 className="size-5" /></div><div><h2 className="font-bold">Identitas tenant</h2><p className="text-xs text-stone-500">Informasi publik dan branding dasar.</p></div></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Nama tenant" error={form.formState.errors.name?.message}><input className="input" {...form.register('name')} /></Field><Field label="Slug" error={form.formState.errors.slug?.message} hint="Huruf kecil, angka, dan tanda hubung."><input className="input font-mono" {...form.register('slug')} /></Field><Field label="Email" error={form.formState.errors.email?.message}><input type="email" className="input" {...form.register('email')} /></Field><Field label="WhatsApp"><input className="input" {...form.register('whatsapp_number')} /></Field><Field label="Warna utama"><div className="flex gap-2"><input type="color" className="h-11 w-14 rounded-xl border-stone-200 p-1" {...form.register('primary_color')} /><input className="input font-mono" {...form.register('primary_color')} /></div></Field><Field label="Custom domain"><input className="input" placeholder="event.domain.com" {...form.register('custom_domain')} /></Field><div className="sm:col-span-2"><Field label="Alamat"><textarea className="input min-h-24" {...form.register('address')} /></Field></div></div></section>
        <section className="surface h-fit p-6"><h2 className="font-bold">Admin Tenant pertama</h2><p className="mt-1 text-xs leading-5 text-stone-500">Password hanya digunakan untuk aktivasi awal dan sebaiknya langsung diganti.</p><div className="mt-6 space-y-5"><Field label="Nama lengkap" error={form.formState.errors.admin_full_name?.message}><input className="input" {...form.register('admin_full_name')} /></Field><Field label="Email admin" error={form.formState.errors.admin_email?.message}><input type="email" className="input" {...form.register('admin_email')} /></Field><Field label="Password sementara" error={form.formState.errors.admin_password?.message}><input type="password" className="input" autoComplete="new-password" {...form.register('admin_password')} /></Field><Button className="w-full" loading={form.formState.isSubmitting}><Save className="size-4" />Buat tenant</Button></div></section>
      </form>
    </div>
  );
}
