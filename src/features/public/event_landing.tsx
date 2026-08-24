"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Sparkles,
  Ticket,
  UsersRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { EmptyState, Skeleton } from "@/components/ui";
import { api_client } from "@/lib/api_client";
import { format_date, format_idr } from "@/lib/format";

export type PublicEventData = {
  event: {
    id: string;
    name: string;
    slug: string;
    short_description: string | null;
    description: string | null;
    banner_url: string | null;
    location_type: string;
    location_name: string | null;
    location_address: string | null;
    start_at: string;
    end_at: string;
    timezone: string;
    registration_start_at: string;
    registration_end_at: string;
    organizer_name: string | null;
    terms_text: string | null;
    privacy_text: string | null;
    tenant: {
      name: string;
      slug: string;
      logo_url: string | null;
      primary_color: string | null;
    };
  };
  ticket_types: Array<{
    id: string;
    name: string;
    description: string | null;
    price: string;
    currency: string;
    quota: number | null;
    minPerOrder: number;
    maxPerOrder: number;
    visibility: string;
  }>;
  add_ons: Array<any>;
};

export function EventLanding({
  tenant_slug,
  event_slug,
}: {
  tenant_slug: string;
  event_slug: string;
}) {
  const query = useQuery({
    queryKey: ["public-event", tenant_slug, event_slug],
    queryFn: () =>
      api_client<PublicEventData>(
        `/public/events/${tenant_slug}/${event_slug}`,
      ),
  });

  if (query.isLoading)
    return (
      <main className="mx-auto max-w-7xl px-5 py-10">
        <Skeleton className="h-[42rem] rounded-[2rem]" />
      </main>
    );
  if (!query.data)
    return (
      <main className="mx-auto max-w-4xl px-5 py-20">
        <EmptyState
          title="Event tidak ditemukan"
          description="Link mungkin salah, event belum dipublikasikan, atau tenant sedang tidak aktif."
        />
      </main>
    );

  const data = query.data.data;
  const event = data.event;
  const register_url = `/e/${tenant_slug}/${event_slug}/register`;
  const lowest_price = data.ticket_types.reduce(
    (lowest, item) => Math.min(lowest, Number(item.price)),
    Number.POSITIVE_INFINITY,
  );

  return (
    <main className="relative min-h-screen overflow-hidden pb-20">
      <div className="pointer-events-none absolute -right-32 top-0 -z-10 size-[34rem] rounded-full bg-moss-100 blur-[110px]" />
      <header className="glass sticky top-3 z-40 mx-auto mt-3 flex max-w-7xl items-center justify-between rounded-[1.35rem] px-4 py-3 sm:px-5">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="grid size-9 place-items-center rounded-xl text-sm font-black text-white shadow-lg"
            style={{ backgroundColor: event.tenant.primary_color ?? "#6846f4" }}
          >
            {event.tenant.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="max-w-[11rem] truncate text-sm font-black tracking-tight sm:max-w-none">
            {event.tenant.name}
          </span>
        </Link>
        <span className="badge border-moss-100 bg-moss-50 text-moss-700">
          <span className="mr-2 size-1.5 rounded-full bg-emerald-500" />
          Registration open
        </span>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-8 sm:pt-10">
        <div className="relative isolate grid min-h-[35rem] overflow-hidden rounded-[2rem] bg-ink text-white shadow-2xl lg:grid-cols-[1.15fr_.85fr] lg:rounded-[2.7rem]">
          <div className="absolute -left-24 -top-20 -z-10 size-80 rounded-full bg-moss-500/35 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -z-10 size-64 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="dot-grid absolute inset-0 -z-10 opacity-[.09] invert" />
          <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
            <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-amber-400">
              {event.organizer_name ?? event.tenant.name} presents
            </span>
            <h1 className="mt-7 max-w-3xl text-[3.25rem] font-black leading-[.9] tracking-[-.065em] sm:text-6xl xl:text-7xl">
              {event.name}
            </h1>
            <p className="mt-6 max-w-xl text-sm font-medium leading-7 text-white/55 sm:text-base">
              {event.short_description ??
                "Satu pengalaman, banyak cerita untuk dibawa pulang."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={register_url}
                className="button-primary bg-amber-400 text-ink shadow-none hover:bg-white"
              >
                Amankan tiket <ArrowRight className="size-4" />
              </Link>
              <span className="flex items-center gap-2 text-xs font-bold text-white/40">
                <UsersRound className="size-4" />
                Kuota terbatas
              </span>
            </div>
          </div>

          <div className="relative flex min-h-[25rem] items-center justify-center p-6 lg:min-h-0 lg:p-10">
            {event.banner_url ? (
              <div
                className="absolute inset-6 rounded-[2rem] bg-cover bg-center opacity-55 lg:inset-8"
                style={{
                  backgroundImage: `linear-gradient(180deg, transparent, rgba(21,20,38,.6)), url("${event.banner_url}")`,
                }}
              />
            ) : (
              <div className="absolute inset-8 rounded-[2rem] bg-gradient-to-br from-moss-500 via-[#5a7cff] to-[#ff7fa7] opacity-80" />
            )}
            <div className="float-soft relative w-full max-w-sm rotate-[-3deg] overflow-hidden rounded-[2rem] bg-white p-5 text-ink shadow-2xl sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-moss-600">
                    Official event pass
                  </p>
                  <p className="mt-2 max-w-[14rem] text-2xl font-black leading-tight tracking-[-.04em]">
                    {event.name}
                  </p>
                </div>
                <span className="grid size-11 place-items-center rounded-2xl bg-ink text-amber-400">
                  <Zap className="size-5" fill="currentColor" />
                </span>
              </div>
              <div className="my-6 flex items-center">
                <span className="-ml-9 size-6 rounded-full bg-ink" />
                <span className="mx-2 flex-1 border-t-2 border-dashed border-stone-200" />
                <span className="-mr-9 size-6 rounded-full bg-ink" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                    Date
                  </p>
                  <p className="mt-1 font-black">
                    {format_date(event.start_at, event.timezone)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                    Starts from
                  </p>
                  <p className="mt-1 font-black text-moss-700">
                    {Number.isFinite(lowest_price) && lowest_price > 0
                      ? format_idr(lowest_price)
                      : "Gratis"}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-moss-50 p-3">
                <Ticket className="size-5 text-moss-700" />
                <span className="text-[10px] font-black uppercase tracking-wider text-moss-700">
                  Tap to join the experience
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info
            icon={CalendarDays}
            label="Kapan"
            value={format_date(event.start_at, event.timezone)}
          />
          <Info
            icon={MapPin}
            label="Di mana"
            value={
              event.location_name ??
              (event.location_type === "online" ? "Online" : "Segera diumumkan")
            }
          />
          <Info
            icon={ShieldCheck}
            label="Registration ends"
            value={format_date(event.registration_end_at, event.timezone)}
          />
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_.8fr] lg:gap-16">
        <article>
          <span className="eyebrow">
            <Sparkles className="size-3" />
            Tentang experience
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-[-.04em] sm:text-5xl">
            Datang. Terlibat. Bawa pulang cerita.
          </h2>
          <div className="mt-6 max-w-2xl whitespace-pre-line text-sm font-medium leading-8 text-stone-600 sm:text-base">
            {event.description ?? event.short_description}
          </div>
          {event.location_address ? (
            <div className="surface mt-8 flex items-start gap-4 p-5">
              <div className="icon-tile">
                <MapPin className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">
                  Full address
                </p>
                <p className="mt-2 text-sm font-bold leading-6">
                  {event.location_address}
                </p>
              </div>
            </div>
          ) : null}
        </article>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-moss-600">
                Choose your vibe
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">
                Pilihan tiket
              </h2>
            </div>
            <Ticket className="size-7 text-moss-500" />
          </div>
          <div className="space-y-3">
            {data.ticket_types.map((ticket, index) => (
              <div
                key={ticket.id}
                className="surface group p-5 transition hover:-translate-y-0.5 hover:border-moss-100"
              >
                <div className="flex justify-between gap-4">
                  <div className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink text-[10px] font-black text-white">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="font-black tracking-tight">{ticket.name}</p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        {ticket.description}
                      </p>
                    </div>
                  </div>
                  <p className="whitespace-nowrap font-black text-moss-700">
                    {Number(ticket.price) === 0
                      ? "Gratis"
                      : format_idr(ticket.price)}
                  </p>
                </div>
                <div className="mt-5 flex justify-between border-t border-dashed border-stone-200 pt-3 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                  <span>
                    {ticket.minPerOrder}–{ticket.maxPerOrder} tiket/order
                  </span>
                  <span>
                    {ticket.quota ? `${ticket.quota} seats` : "Unlimited"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link href={register_url} className="button-primary mt-4 w-full">
            Pilih tiket & lanjut <ArrowRight className="size-4" />
          </Link>
        </aside>
      </section>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="surface flex items-center gap-4 p-4">
      <div className="icon-tile">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[.16em] text-stone-400">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-black tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
