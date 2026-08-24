'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, MapPin, Plus, Search, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { api_client } from '@/lib/api_client';
import { format_date } from '@/lib/format';

type EventRecord = { id: string; name: string; slug: string; shortDescription: string | null; startAt: string; timezone: string; locationName: string | null; status: string; _count: { registrations: number; tickets: number } };

export function EventList() {
  const [search, set_search] = useState('');
  const query = useQuery({ queryKey: ['events', search], queryFn: () => api_client<{ events: EventRecord[] }>(`/events?search=${encodeURIComponent(search)}`) });
  return <div><PageHeader eyebrow="Tenant aktif" title="Event" description="Buat, siapkan, publikasikan, lalu pantau event dari satu workspace." action={<Link href="/admin/events/new" className="button-primary"><Plus className="size-4" />Event baru</Link>} /><div className="surface mb-5 flex items-center gap-3 p-3"><Search className="ml-2 size-4 text-stone-400" /><input className="w-full border-0 bg-transparent text-sm focus:ring-0" value={search} onChange={(event) => set_search(event.target.value)} placeholder="Cari event..." /></div>{query.isLoading ? <div className="grid gap-4 lg:grid-cols-2">{[1,2].map((key) => <Skeleton key={key} className="h-56" />)}</div> : null}{!query.isLoading && !query.data?.data.events.length ? <EmptyState title="Belum ada event" description="Mulai dari informasi event, lalu lanjutkan tiket, add-on, form, preview, dan publikasi." action={<Link href="/admin/events/new" className="button-primary">Buat event</Link>} /> : null}<div className="grid gap-4 lg:grid-cols-2">{query.data?.data.events.map((event) => <Link href={`/admin/events/${event.id}`} key={event.id} className="surface group p-5 transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-xl bg-moss-50 text-moss-700"><CalendarDays className="size-5" /></div><StatusBadge status={event.status} /></div><h2 className="mt-5 text-xl font-bold">{event.name}</h2><p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-500">{event.shortDescription ?? 'Belum ada deskripsi singkat.'}</p><div className="mt-5 flex flex-wrap gap-4 border-t border-stone-100 pt-4 text-xs text-stone-500"><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{format_date(event.startAt, event.timezone)}</span><span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{event.locationName ?? 'Online'}</span><span className="flex items-center gap-1.5"><UsersRound className="size-3.5" />{event._count.registrations}</span><ArrowRight className="ml-auto size-4 transition group-hover:translate-x-1" /></div></Link>)}</div></div>;
}
