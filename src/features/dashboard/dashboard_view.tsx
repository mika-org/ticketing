"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  ScanLine,
  Sparkles,
  Ticket,
  UsersRound,
  Zap,
} from "lucide-react";
import { PageHeader, Skeleton } from "@/components/ui";
import { api_client } from "@/lib/api_client";

type DashboardData = {
  tenants: number;
  events: number;
  registrations: number;
  tickets: number;
  check_ins: number;
};

export function DashboardView({ global = false }: { global?: boolean }) {
  const query = useQuery({
    queryKey: ["dashboard", global],
    queryFn: () => api_client<DashboardData>("/dashboard"),
  });
  const cards = [
    ...(global
      ? [
          {
            key: "tenants" as const,
            label: "Tenant aktif",
            icon: Building2,
            style: "bg-amber-400 text-ink",
          },
        ]
      : []),
    {
      key: "events" as const,
      label: "Total event",
      icon: CalendarDays,
      style: "bg-moss-600 text-white",
    },
    {
      key: "registrations" as const,
      label: "Pendaftar",
      icon: UsersRound,
      style: "bg-[#dff6ff] text-ink",
    },
    {
      key: "tickets" as const,
      label: "Tiket terbit",
      icon: Ticket,
      style: "bg-[#ffdce9] text-ink",
    },
    {
      key: "check_ins" as const,
      label: "Check-in",
      icon: ScanLine,
      style: "bg-white text-ink",
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={global ? "Platform overview" : "Tenant pulse"}
        title={
          global
            ? "What’s happening, right now."
            : "Hari ini, dalam satu layar."
        }
        description={
          global
            ? "Pantau pertumbuhan platform dan buka tenant yang perlu ditangani."
            : "Lihat kesiapan event dan aktivitas peserta pada tenant aktif."
        }
      />
      <div
        className={`grid gap-4 sm:grid-cols-2 ${global ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
      >
        {cards.map((card, index) => (
          <article
            key={card.key}
            className={`relative min-h-44 overflow-hidden rounded-[1.5rem] border border-white/70 p-5 shadow-soft ${card.style}`}
          >
            <div className="absolute -right-8 -top-8 size-28 rounded-full border-[18px] border-current opacity-[.06]" />
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-2xl bg-white/25 ring-1 ring-inset ring-current/10">
                <card.icon className="size-5" />
              </span>
              <span className="text-[9px] font-black uppercase tracking-[.18em] opacity-45">
                0{index + 1}
              </span>
            </div>
            {query.isLoading ? (
              <Skeleton className="mt-7 h-9 w-20" />
            ) : (
              <p className="mt-6 text-4xl font-black tracking-[-.06em]">
                {query.data?.data[card.key]?.toLocaleString("id-ID") ?? 0}
              </p>
            )}
            <p className="mt-1 text-xs font-bold opacity-60">{card.label}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="surface p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <span className="eyebrow">
                <Sparkles className="size-3" />
                Next moves
              </span>
              <h2 className="mt-4 text-2xl font-black tracking-tight">
                Fokus operasional
              </h2>
            </div>
            <ArrowUpRight className="size-5 text-stone-300" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              [
                "Set the stage",
                "Pastikan tiket aktif sebelum event dipublikasikan.",
              ],
              [
                "Watch the flow",
                "Periksa transaksi pending dan webhook terbaru.",
              ],
              ["Own the door", "Siapkan crew serta perangkat check-in."],
            ].map(([title, text], index) => (
              <div
                key={title}
                className="group rounded-[1.25rem] border border-stone-100 bg-stone-50/60 p-4 transition hover:border-moss-100 hover:bg-moss-50"
              >
                <span className="text-[10px] font-black text-moss-600">
                  0{index + 1}
                </span>
                <p className="mt-5 text-sm font-black">{title}</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="relative overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white shadow-soft sm:p-7">
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-moss-500/40 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-amber-400">
                System pulse
              </span>
              <Zap className="size-5 text-amber-400" fill="currentColor" />
            </div>
            <h2 className="mt-8 text-3xl font-black leading-tight tracking-[-.05em]">
              Everything is live & connected.
            </h2>
            <p className="mt-3 text-xs leading-6 text-white/45">
              API dan database siap menjaga event tetap bergerak.
            </p>
            <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider">
              <span className="pulse-ring size-2 rounded-full bg-emerald-400" />
              Operational
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
