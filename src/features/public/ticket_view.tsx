"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton, StatusBadge } from "@/components/ui";
import { api_client } from "@/lib/api_client";
import { format_date } from "@/lib/format";

type TicketData = {
  ticket: {
    ticket_code: string;
    holder_name: string;
    holder_email: string;
    status: string;
    event: { name: string; startAt: string; locationName: string | null };
  };
};

export function TicketView({
  ticket_code,
  token,
}: {
  ticket_code: string;
  token: string;
}) {
  const query = useQuery({
    queryKey: ["ticket", ticket_code, token],
    queryFn: () =>
      api_client<TicketData>(
        `/public/tickets/${ticket_code}?token=${encodeURIComponent(token)}`,
      ),
    enabled: !!token,
  });
  if (query.isLoading)
    return (
      <main className="mx-auto max-w-xl px-5 py-12">
        <Skeleton className="h-[40rem]" />
      </main>
    );
  if (!query.data)
    return (
      <main className="grid min-h-screen place-items-center p-5">
        <div className="surface max-w-md p-8 text-center">
          <Ticket className="mx-auto size-9 text-stone-300" />
          <h1 className="mt-5 text-xl font-bold">Tiket tidak ditemukan</h1>
          <p className="mt-2 text-sm text-stone-500">
            Link tiket tidak lengkap atau token tidak valid.
          </p>
        </div>
      </main>
    );
  const ticket = query.data.data.ticket;
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute left-1/2 top-8 -z-10 size-[28rem] -translate-x-1/2 rounded-full bg-moss-100 blur-[90px]" />
      <div className="mx-auto max-w-xl overflow-hidden rounded-[2.25rem] border border-white bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-ink p-7 text-white sm:p-8">
          <div className="absolute -right-16 -top-20 size-56 rounded-full bg-moss-500/45 blur-3xl" />
          <div className="flex justify-between">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">
              Tiket event
            </p>
            <StatusBadge status={ticket.status} />
          </div>
          <h1 className="relative mt-6 font-[var(--font-display)] text-4xl font-black tracking-[-.05em]">
            {ticket.event.name}
          </h1>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/60">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4" />
              {format_date(ticket.event.startAt)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-4" />
              {ticket.event.locationName ?? "Online"}
            </span>
          </div>
        </div>
        <div className="p-7 text-center">
          <p className="text-sm font-bold">{ticket.holder_name}</p>
          <p className="mt-1 text-xs text-stone-400">{ticket.holder_email}</p>
          <div className="mx-auto mt-7 w-fit rounded-[1.75rem] border-8 border-moss-50 p-4 shadow-lg ring-2 ring-moss-500">
            <QRCodeSVG value={token} size={230} />
          </div>
          <p className="mt-5 font-mono text-sm font-black tracking-[.15em]">
            {ticket.ticket_code}
          </p>
          <p className="mt-2 text-xs text-stone-400">
            QR tiket · tunjukkan kepada petugas check-in
          </p>
          <div className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-moss-50 p-3 text-xs font-semibold text-moss-700">
            <ShieldCheck className="size-4" />
            Token bersifat opaque dan tidak menyimpan data pribadi.
          </div>
        </div>
      </div>
    </main>
  );
}
