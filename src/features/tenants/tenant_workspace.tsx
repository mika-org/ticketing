"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  KeyRound,
  Plus,
  Save,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  EmptyState,
  Field,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { api_client } from "@/lib/api_client";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  status: string;
  address: string | null;
  primaryColor: string | null;
  _count: {
    users: number;
    events: number;
    registrations: number;
    tickets: number;
  };
};

export function TenantWorkspace({
  tenant_id,
  section = "detail",
}: {
  tenant_id: string;
  section?: string;
}) {
  const router = useRouter();
  const tenant = useQuery({
    queryKey: ["tenant", tenant_id],
    queryFn: () => api_client<{ tenant: Tenant }>(`/tenants/${tenant_id}`),
  });
  const select = useMutation({
    mutationFn: () =>
      api_client("/auth/tenant-context", {
        method: "POST",
        body: JSON.stringify({ tenant_id }),
      }),
    onSuccess: () => {
      router.push("/admin/events");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (tenant.isLoading) return <Skeleton className="h-96" />;
  if (!tenant.data)
    return (
      <EmptyState
        title="Tenant tidak ditemukan"
        description="Data tidak tersedia atau akses ditolak."
      />
    );
  const value = tenant.data.data.tenant;
  const tabs = [
    ["detail", "Ringkasan"],
    ["users", "Pengguna"],
    ["events", "Event"],
    ["payment-settings", "Pembayaran"],
  ];
  return (
    <div>
      <PageHeader
        eyebrow={`Tenant · ${value.slug}`}
        title={value.name}
        description="Kelola identitas, pengguna, event, dan integrasi tenant."
        action={
          <Button onClick={() => select.mutate()} loading={select.isPending}>
            Buka konteks <ArrowRight className="size-4" />
          </Button>
        }
      />
      <nav className="glass mb-6 flex gap-1 overflow-x-auto rounded-[1.35rem] p-1.5">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={
              key === "detail"
                ? `/super-admin/tenants/${tenant_id}`
                : `/super-admin/tenants/${tenant_id}/${key}`
            }
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${section === key ? "bg-moss-600 text-white shadow-lg" : "text-stone-500 hover:bg-moss-50 hover:text-moss-700"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {section === "detail" ? (
        <div className="grid gap-5 lg:grid-cols-4">
          <Metric icon={Users} label="Pengguna" value={value._count.users} />
          <Metric
            icon={CalendarDays}
            label="Event"
            value={value._count.events}
          />
          <Metric
            icon={Users}
            label="Pendaftar"
            value={value._count.registrations}
          />
          <Metric icon={KeyRound} label="Tiket" value={value._count.tickets} />
          <div className="surface p-6 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Informasi tenant</h2>
              <StatusBadge status={value.status} />
            </div>
            <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-stone-400">Email</dt>
                <dd className="mt-1 font-semibold">{value.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Slug publik</dt>
                <dd className="mt-1 font-mono">/{value.slug}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Alamat</dt>
                <dd className="mt-1 font-semibold">{value.address ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
      {section === "users" ? <TenantUsers tenant_id={tenant_id} /> : null}
      {section === "events" ? (
        <EmptyState
          title="Kelola event dalam konteks tenant"
          description="Aktifkan konteks tenant agar setiap query event membawa scope yang benar."
          action={
            <Button onClick={() => select.mutate()} loading={select.isPending}>
              Aktifkan dan buka event
            </Button>
          }
        />
      ) : null}
      {section === "payment-settings" ? (
        <PaymentSettings tenant_id={tenant_id} />
      ) : null}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="surface p-5">
      <Icon className="size-5 text-moss-600" />
      <p className="mt-5 text-3xl font-bold">{value}</p>
      <p className="text-xs font-semibold text-stone-500">{label}</p>
    </div>
  );
}

function TenantUsers({ tenant_id }: { tenant_id: string }) {
  const query = useQuery({
    queryKey: ["tenant-users", tenant_id],
    queryFn: () => api_client<{ users: any[] }>(`/tenants/${tenant_id}/users`),
  });
  const [open, set_open] = useState(false);
  const [form, set_form] = useState({
    full_name: "",
    email: "",
    whatsapp_number: "",
    role: "tenant_admin",
    password: "",
  });
  const create = useMutation({
    mutationFn: () =>
      api_client(`/tenants/${tenant_id}/users`, {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success("Pengguna dibuat");
      set_open(false);
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => set_open((value) => !value)}>
          <Plus className="size-4" />
          Tambah pengguna
        </Button>
      </div>
      {open ? (
        <div className="surface mb-5 grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nama">
            <input
              className="input"
              value={form.full_name}
              onChange={(event) =>
                set_form({ ...form, full_name: event.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) =>
                set_form({ ...form, email: event.target.value })
              }
            />
          </Field>
          <Field label="Role">
            <select
              className="input"
              value={form.role}
              onChange={(event) =>
                set_form({ ...form, role: event.target.value })
              }
            >
              <option value="tenant_admin">Admin Tenant</option>
              <option value="event_staff">Event Staff</option>
            </select>
          </Field>
          <Field label="Password sementara">
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) =>
                set_form({ ...form, password: event.target.value })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              Simpan pengguna
            </Button>
          </div>
        </div>
      ) : null}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-5 py-3">Pengguna</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {query.data?.data.users.map((membership) => (
                <tr key={membership.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold">{membership.user.fullName}</p>
                    <p className="text-xs text-stone-400">
                      {membership.user.email}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {membership.role.replaceAll("_", " ")}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={membership.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PaymentSettings({ tenant_id }: { tenant_id: string }) {
  const query = useQuery({
    queryKey: ["payment-config", tenant_id],
    queryFn: () =>
      api_client<{ payment_config: any }>(
        `/tenants/${tenant_id}/payment-config`,
      ),
  });
  const [form, set_form] = useState({
    account_mode: "tenant",
    environment: "test",
    business_id: "",
    secret_api_key: "",
    webhook_token: "",
    api_version: "2024-11-11",
    is_active: true,
  });
  const save = useMutation({
    mutationFn: () =>
      api_client(`/tenants/${tenant_id}/payment-config`, {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success("Konfigurasi disimpan");
      set_form({ ...form, secret_api_key: "", webhook_token: "" });
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const test = useMutation({
    mutationFn: () =>
      api_client(`/tenants/${tenant_id}/payment-config/test`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: () => {
      toast.success("Koneksi Xendit berhasil");
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]">
      <div className="surface h-fit p-6">
        <CreditCard className="size-6 text-moss-600" />
        <h2 className="mt-5 font-bold">Status Xendit</h2>
        {query.data?.data.payment_config ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Environment</span>
              <StatusBadge
                status={query.data.data.payment_config.environment}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Secret</span>
              <span className="font-semibold">Terkonfigurasi</span>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              loading={test.isPending}
              onClick={() => test.mutate()}
            >
              Test connection
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Belum ada konfigurasi khusus tenant.
          </p>
        )}
      </div>
      <div className="surface p-6">
        <h2 className="font-bold">Konfigurasi credential</h2>
        <p className="mt-1 text-xs text-stone-500">
          Secret hanya dikirim sekali dan tidak dapat dibaca kembali.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Mode akun">
            <select
              className="input"
              value={form.account_mode}
              onChange={(event) =>
                set_form({ ...form, account_mode: event.target.value })
              }
            >
              <option value="tenant">Akun tenant</option>
              <option value="platform">Akun platform</option>
            </select>
          </Field>
          <Field label="Environment">
            <select
              className="input"
              value={form.environment}
              onChange={(event) =>
                set_form({ ...form, environment: event.target.value })
              }
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </Field>
          <Field label="Business ID">
            <input
              className="input"
              value={form.business_id}
              onChange={(event) =>
                set_form({ ...form, business_id: event.target.value })
              }
            />
          </Field>
          <div />
          <Field label="Secret API key">
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={form.secret_api_key}
              onChange={(event) =>
                set_form({ ...form, secret_api_key: event.target.value })
              }
            />
          </Field>
          <Field label="Webhook token">
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={form.webhook_token}
              onChange={(event) =>
                set_form({ ...form, webhook_token: event.target.value })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              <Save className="size-4" />
              Simpan dan rotasi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
