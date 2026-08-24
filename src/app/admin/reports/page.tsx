import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/ui';
export default function Page(){return <div><PageHeader eyebrow="Analitik" title="Laporan" description="Pilih event untuk melihat pendaftar, pendapatan, tiket, pembayaran, dan check-in dalam scope yang tepat."/><EmptyState title="Laporan tersedia per event" description="Buka workspace event lalu lihat ringkasan dan daftar operasional yang selalu tenant-scoped." action={<Link href="/admin/events" className="button-primary"><BarChart3 className="size-4"/>Pilih event</Link>}/></div>}
