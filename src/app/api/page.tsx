import Link from 'next/link';
import { Logo } from '@/components/logo';

const groups = [
  ['Authentication', ['POST /api/v1/auth/login', 'POST /api/v1/auth/refresh', 'GET /api/v1/auth/me', 'POST /api/v1/auth/tenant-context']],
  ['Tenants', ['GET|POST /api/v1/tenants', 'GET|PATCH /api/v1/tenants/:id', 'GET|POST /api/v1/tenants/:id/users', 'GET|PUT /api/v1/tenants/:id/payment-config']],
  ['Events', ['GET|POST /api/v1/events', 'GET|PATCH /api/v1/events/:id', 'POST /api/v1/events/:id/publish', 'GET|POST /api/v1/events/:id/ticket-types', 'GET|POST /api/v1/events/:id/add-ons', 'GET|POST /api/v1/events/:id/form-fields']],
  ['Public & Payment', ['GET /api/v1/public/events/:tenant/:event', 'POST /api/v1/public/events/:tenant/:event/registrations', 'POST /api/v1/public/registrations/:code/payments/qris', 'GET /api/v1/public/registrations/:code/payment-status', 'POST /api/v1/webhooks/xendit/payments']],
  ['Operations', ['GET /api/v1/events/:id/registrations', 'GET /api/v1/events/:id/tickets', 'POST /api/v1/events/:id/check-ins/validate', 'POST /api/v1/events/:id/check-ins', 'GET /api/v1/events/:id/reports/summary']],
];

export default function ApiReferencePage(){return <main className="mx-auto max-w-5xl px-5 py-10"><div className="flex items-center justify-between"><Logo/><Link href="/" className="button-secondary">Beranda</Link></div><div className="mt-16"><p className="text-xs font-bold uppercase tracking-[.2em] text-moss-600">Next.js Route Handlers</p><h1 className="mt-3 font-[var(--font-display)] text-5xl font-semibold">API Reference</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">Semua endpoint memakai envelope JSON konsisten. Endpoint privat menerima cookie httpOnly atau Bearer token dan selalu melakukan scope tenant di server.</p></div><div className="mt-10 space-y-4">{groups.map(([title,endpoints])=><section key={title as string} className="surface p-6"><h2 className="font-bold">{title}</h2><div className="mt-4 space-y-2">{(endpoints as string[]).map(endpoint=><code key={endpoint} className="block rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">{endpoint}</code>)}</div></section>)}</div></main>}
