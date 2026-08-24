"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  KeyRound,
  Save,
  ShieldCheck,
  TestTube2,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Field,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { api_client } from "@/lib/api_client";
import { format_date } from "@/lib/format";

type PaymentConfig = {
  id: string;
  environment: "test" | "live";
  businessId: string | null;
  apiVersion: string;
  isActive: boolean;
  verifiedAt: string | null;
  updatedAt: string;
  secret_configured: boolean;
  webhook_configured: boolean;
};

type ConfigResponse = {
  payment_config: PaymentConfig | null;
  webhook_path: string;
};

export function TenantPaymentSettings() {
  const query = useQuery({
    queryKey: ["tenant-payment-settings"],
    queryFn: () => api_client<ConfigResponse>("/payment-settings"),
  });
  if (query.isLoading) return <Skeleton className="h-[38rem]" />;
  const config = query.data?.data.payment_config ?? null;
  const webhook_path =
    query.data?.data.webhook_path ?? "/api/v1/webhooks/xendit/payments";
  return (
    <div>
      <PageHeader
        eyebrow="Tenant payment rail"
        title="Xendit, milik tenant ini."
        description="API key, webhook token, dan environment disimpan terenkripsi serta tidak digunakan oleh tenant lain."
      />
      <PaymentConfigForm
        key={config?.updatedAt ?? "new"}
        config={config}
        webhook_path={webhook_path}
        refresh={() => query.refetch()}
      />
    </div>
  );
}

function PaymentConfigForm({
  config,
  webhook_path,
  refresh,
}: {
  config: PaymentConfig | null;
  webhook_path: string;
  refresh: () => Promise<unknown>;
}) {
  const [form, set_form] = useState({
    environment: config?.environment ?? ("test" as "test" | "live"),
    business_id: config?.businessId ?? "",
    secret_api_key: "",
    webhook_token: "",
    api_version: config?.apiVersion ?? "2024-11-11",
    is_active: config?.isActive ?? true,
  });
  const save = useMutation({
    mutationFn: () =>
      api_client("/payment-settings", {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: async () => {
      toast.success("Konfigurasi Xendit tenant disimpan");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const test = useMutation({
    mutationFn: () =>
      api_client("/payment-settings/test", { method: "POST", body: "{}" }),
    onSuccess: async () => {
      toast.success("Koneksi Xendit berhasil diverifikasi");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function copy_webhook() {
    void navigator.clipboard.writeText(webhook_path);
    toast.success("Path webhook disalin");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <aside className="space-y-5">
        <section className="relative overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white shadow-soft">
          <div className="absolute -right-14 -top-14 size-44 rounded-full bg-moss-500/40 blur-3xl" />
          <CreditCard className="relative size-7 text-amber-400" />
          <p className="relative mt-8 text-[10px] font-black uppercase tracking-[.2em] text-white/40">
            Connection status
          </p>
          <h2 className="relative mt-2 text-2xl font-black tracking-tight">
            {config ? "Credential configured" : "Belum dikonfigurasi"}
          </h2>
          <div className="relative mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
            <StatusRow
              label="API key"
              ready={config?.secret_configured ?? false}
            />
            <StatusRow
              label="Webhook token"
              ready={config?.webhook_configured ?? false}
            />
            <div className="flex items-center justify-between">
              <span className="text-white/45">Environment</span>
              <StatusBadge status={config?.environment ?? "not_set"} />
            </div>
          </div>
          <Button
            variant="secondary"
            className="relative mt-6 w-full border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            disabled={!config?.isActive}
            loading={test.isPending}
            onClick={() => test.mutate()}
          >
            <TestTube2 className="size-4" />
            Test connection
          </Button>
        </section>
        <section className="surface p-5">
          <div className="flex items-start gap-4">
            <div className="icon-tile">
              <Webhook className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black">Webhook URL</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Tambahkan domain aplikasi sebelum path berikut pada dashboard
                Xendit.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-stone-50 p-3">
            <code className="min-w-0 flex-1 break-all text-[11px] text-stone-600">
              {webhook_path}
            </code>
            <button
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-moss-700 shadow-sm"
              onClick={copy_webhook}
              aria-label="Salin webhook"
            >
              <Copy className="size-4" />
            </button>
          </div>
        </section>
      </aside>

      <section className="surface p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-moss-600">
              Tenant-scoped secrets
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Credential Xendit
            </h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Secret dienkripsi sebelum masuk database dan tidak pernah dikirim
              kembali ke browser.
            </p>
          </div>
          <div className="icon-tile">
            <KeyRound className="size-5" />
          </div>
        </div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <Field label="Environment">
            <select
              className="input"
              value={form.environment}
              onChange={(event) =>
                set_form({
                  ...form,
                  environment: event.target.value as "test" | "live",
                })
              }
            >
              <option value="test">Test / Sandbox</option>
              <option value="live">Live / Production</option>
            </select>
          </Field>
          <Field
            label="Business ID"
            hint="Opsional, untuk validasi webhook lebih ketat."
          >
            <input
              className="input"
              value={form.business_id}
              onChange={(event) =>
                set_form({ ...form, business_id: event.target.value })
              }
            />
          </Field>
          <Field
            label="Secret API key"
            hint={
              config?.secret_configured
                ? "Kosongkan jika tidak ingin merotasi API key."
                : "Wajib untuk konfigurasi pertama."
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              placeholder={
                config?.secret_configured
                  ? "••••••••••••••••"
                  : "xnd_development_..."
              }
              value={form.secret_api_key}
              onChange={(event) =>
                set_form({ ...form, secret_api_key: event.target.value })
              }
            />
          </Field>
          <Field
            label="Webhook verification token"
            hint={
              config?.webhook_configured
                ? "Kosongkan jika token tetap sama."
                : "Salin dari pengaturan webhook Xendit."
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              placeholder={
                config?.webhook_configured
                  ? "••••••••••••••••"
                  : "Webhook token"
              }
              value={form.webhook_token}
              onChange={(event) =>
                set_form({ ...form, webhook_token: event.target.value })
              }
            />
          </Field>
          <Field label="API version">
            <input
              className="input font-mono"
              value={form.api_version}
              onChange={(event) =>
                set_form({ ...form, api_version: event.target.value })
              }
            />
          </Field>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold">
            <input
              type="checkbox"
              className="rounded border-stone-300 text-moss-600 focus:ring-moss-500"
              checked={form.is_active}
              onChange={(event) =>
                set_form({ ...form, is_active: event.target.checked })
              }
            />
            Aktifkan pembayaran Xendit
          </label>
        </div>
        {form.environment === "live" ? (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <ShieldCheck className="size-5 shrink-0" />
            <span>
              Mode Live menerima pembayaran nyata. Jalankan Test connection
              sebelum membuka registrasi publik.
            </span>
          </div>
        ) : null}
        <div className="mt-7 flex flex-col gap-3 border-t border-stone-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-stone-400">
            {config?.verifiedAt
              ? `Terakhir diverifikasi ${format_date(config.verifiedAt)}`
              : "Belum pernah diverifikasi"}
          </p>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            <Save className="size-4" />
            Simpan konfigurasi
          </Button>
        </div>
      </section>
    </div>
  );
}

function StatusRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/45">{label}</span>
      <span
        className={`flex items-center gap-2 text-xs font-bold ${ready ? "text-emerald-300" : "text-white/35"}`}
      >
        <CheckCircle2 className="size-4" />
        {ready ? "Siap" : "Belum"}
      </span>
    </div>
  );
}
