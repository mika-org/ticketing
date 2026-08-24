"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Skeleton, StatusBadge } from "@/components/ui";
import { api_client } from "@/lib/api_client";
import { format_idr } from "@/lib/format";

type StatusData = {
  registration_code: string;
  registration_status: string;
  payment: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    qr_string: string | null;
    qr_expires_at: string | null;
    reference_id: string;
  } | null;
  tickets: Array<{ ticket_code: string; qr_token: string }>;
};

export function PaymentView({
  tenant_slug: _tenant_slug,
  event_slug: _event_slug,
  registration_code,
}: {
  tenant_slug: string;
  event_slug: string;
  registration_code: string;
}) {
  const query = useQuery({
    queryKey: ["payment-status", registration_code],
    queryFn: () =>
      api_client<StatusData>(
        `/public/registrations/${registration_code}/payment-status`,
      ),
    refetchInterval: (state) => {
      const status = state.state.data?.data.registration_status;
      return ["confirmed", "expired", "cancelled"].includes(status ?? "")
        ? false
        : 4000;
    },
    refetchIntervalInBackground: false,
  });
  const retry = useMutation({
    mutationFn: () =>
      api_client(`/public/registrations/${registration_code}/payments/retry`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: () => {
      toast.success("Pembayaran baru dibuat");
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const [remaining, set_remaining] = useState("");
  const data = query.data?.data;
  const expires_at = data?.payment?.qr_expires_at;
  useEffect(() => {
    if (!expires_at) return;
    const update = () => {
      const seconds = Math.max(
        0,
        Math.floor((new Date(expires_at).getTime() - Date.now()) / 1000),
      );
      set_remaining(
        `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expires_at]);
  if (query.isLoading)
    return (
      <main className="mx-auto max-w-4xl px-5 py-12">
        <Skeleton className="h-[36rem]" />
      </main>
    );
  if (data?.registration_status === "confirmed" && data.tickets[0]) {
    const ticket = data.tickets[0];
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
        <div className="pointer-events-none absolute size-[30rem] rounded-full bg-moss-100 blur-[90px]" />
        <div className="surface relative w-full max-w-lg overflow-hidden p-8 text-center sm:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-8" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-emerald-600">
            Pembayaran terkonfirmasi
          </p>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl font-black tracking-[-.05em]">
            Tiket Anda sudah siap.
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">
            Status berhasil berasal dari backend setelah webhook pembayaran
            tervalidasi.
          </p>
          <Link
            className="button-primary mt-7 w-full"
            href={`/ticket/${ticket.ticket_code}?token=${encodeURIComponent(ticket.qr_token)}`}
          >
            Buka tiket
          </Link>
        </div>
      </main>
    );
  }
  const payment = data?.payment;
  return (
    <main className="relative mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-moss-600">
          Secure QRIS checkout
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-black tracking-[-.05em] sm:text-5xl">
          Selesaikan pembayaran
        </h1>
        <p className="mt-2 font-mono text-xs text-stone-400">
          {registration_code}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_.72fr]">
        <section className="surface overflow-hidden p-6 text-center sm:p-8">
          <div className="flex items-center justify-between">
            <StatusBadge status={payment?.status ?? "pending"} />
            {remaining ? (
              <span className="flex items-center gap-2 text-sm font-bold text-amber-700">
                <Clock3 className="size-4" />
                {remaining}
              </span>
            ) : null}
          </div>
          {payment?.qr_string ? (
            <>
              <div className="mx-auto mt-8 w-fit rounded-[1.75rem] border-8 border-moss-50 bg-white p-4 shadow-xl ring-2 ring-moss-500">
                <QRCodeSVG value={payment.qr_string} size={240} />
              </div>
              <p className="mt-5 text-xs text-stone-400">
                QR pembayaran · jangan gunakan sebagai QR tiket
              </p>
            </>
          ) : (
            <div className="mx-auto mt-8 grid size-72 place-items-center rounded-2xl bg-stone-50">
              <RefreshCw className="size-8 animate-spin text-stone-300" />
            </div>
          )}
          <p className="mt-6 text-3xl font-black tracking-[-.04em]">
            {payment ? format_idr(payment.amount) : "Menyiapkan QR..."}
          </p>
        </section>
        <aside className="space-y-5">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white shadow-soft">
            <div className="absolute -right-12 -top-12 size-36 rounded-full bg-moss-500/35 blur-2xl" />
            <ShieldCheck className="relative size-6 text-amber-400" />
            <h2 className="relative mt-5 font-black">Cara membayar</h2>
            <ol className="relative mt-4 space-y-3 text-sm leading-6 text-white/50">
              <li>1. Buka aplikasi bank atau e-wallet.</li>
              <li>2. Pilih Scan QRIS dan arahkan ke QR.</li>
              <li>3. Pastikan nominal sesuai, lalu konfirmasi.</li>
              <li>4. Kembali ke halaman ini dan periksa status.</li>
            </ol>
            <Button
              className="mt-6 w-full"
              variant="secondary"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw className="size-4" />
              Saya sudah bayar
            </Button>
          </div>
          {["expired", "failed"].includes(payment?.status ?? "") ? (
            <div className="surface border-amber-200 bg-amber-50 p-6">
              <h3 className="font-bold text-amber-900">
                Pembayaran tidak aktif
              </h3>
              <p className="mt-1 text-sm text-amber-800/70">
                Buat QR baru bila pendaftaran dan kuota masih diizinkan backend.
              </p>
              <Button
                className="mt-4"
                loading={retry.isPending}
                onClick={() => retry.mutate()}
              >
                Buat ulang pembayaran
              </Button>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
