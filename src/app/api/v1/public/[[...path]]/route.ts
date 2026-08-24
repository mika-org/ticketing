import { NextRequest } from 'next/server';
import { ApiError, api_error, api_ok, parse_body, rate_limit } from '@/lib/server/api';
import { sha256 } from '@/lib/server/crypto';
import { create_qris, payment_status, retry_payment } from '@/lib/server/payments';
import { prisma } from '@/lib/server/prisma';
import { create_registration, resolve_public_event } from '@/lib/server/registration';
import { registration_schema } from '@/lib/validation';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, route_context: RouteContext) {
  try {
    const path = (await route_context.params).path ?? [];
    if (path[0] === 'events' && path.length >= 3) {
      const event = await resolve_public_event(path[1], path[2]);
      if (path.length === 3) return public_event(event);
      if (path[3] === 'form') return public_form(event.tenantId, event.id);
      if (path[3] === 'availability') return availability(event.tenantId, event.id, event);
    }
    if (path[0] === 'registrations' && path[2] === 'payment-status') return api_ok(await payment_status(path[1]));
    if (path[0] === 'tickets' && path.length === 2) return public_ticket(request, path[1]);
    throw new ApiError(404, 'not_found', 'Endpoint tidak ditemukan');
  } catch (error) {
    return api_error(error);
  }
}

export async function POST(request: NextRequest, route_context: RouteContext) {
  try {
    rate_limit(request, 'public-registration', 30, 60_000);
    const path = (await route_context.params).path ?? [];
    if (path[0] === 'events' && path[3] === 'registrations') {
      const input = await parse_body(request, registration_schema);
      const result = await create_registration(path[1], path[2], request.headers.get('idempotency-key') ?? '', input);
      return api_ok(result, undefined, 201);
    }
    if (path[0] === 'registrations' && path[2] === 'payments' && path[3] === 'qris') return api_ok(await create_qris(path[1]));
    if (path[0] === 'registrations' && path[2] === 'payments' && path[3] === 'retry') return api_ok(await retry_payment(path[1]));
    throw new ApiError(404, 'not_found', 'Endpoint tidak ditemukan');
  } catch (error) {
    return api_error(error);
  }
}

async function public_event(event: Awaited<ReturnType<typeof resolve_public_event>>) {
  const [ticket_types, add_ons] = await Promise.all([
    prisma.ticketType.findMany({
      where: { tenantId: event.tenantId, eventId: event.id, isActive: true, deletedAt: null, visibility: { not: 'hidden' } },
      select: { id: true, name: true, slug: true, description: true, price: true, currency: true, quota: true, minPerOrder: true, maxPerOrder: true, visibility: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.addOn.findMany({
      where: { tenantId: event.tenantId, eventId: event.id, isActive: true, deletedAt: null },
      include: { options: { where: { isActive: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } }, ticketTypeLinks: { select: { ticketTypeId: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  return api_ok({
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      short_description: event.shortDescription,
      description: event.description,
      banner_url: event.bannerUrl,
      location_type: event.locationType,
      location_name: event.locationName,
      location_address: event.locationAddress,
      start_at: event.startAt,
      end_at: event.endAt,
      timezone: event.timezone,
      registration_start_at: event.registrationStartAt,
      registration_end_at: event.registrationEndAt,
      organizer_name: event.organizerName,
      terms_text: event.termsText,
      privacy_text: event.privacyText,
      tenant: { name: event.tenant.name, slug: event.tenant.slug, logo_url: event.tenant.logoUrl, primary_color: event.tenant.primaryColor },
    },
    ticket_types,
    add_ons,
  });
}

async function public_form(tenant_id: string, event_id: string) {
  const form_fields = await prisma.formField.findMany({
    where: { tenantId: tenant_id, eventId: event_id, isActive: true, deletedAt: null },
    include: { options: { where: { isActive: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });
  return api_ok({ form_fields });
}

async function availability(tenant_id: string, event_id: string, event: Awaited<ReturnType<typeof resolve_public_event>>) {
  const ticket_types = await prisma.ticketType.findMany({ where: { tenantId: tenant_id, eventId: event_id, isActive: true, deletedAt: null }, select: { id: true, quota: true } });
  const counts = await prisma.registrationItem.groupBy({ by: ['ticketTypeId'], where: { tenantId: tenant_id, registration: { eventId: event_id, status: { in: ['pending', 'pending_payment', 'confirmed'] } } }, _sum: { quantity: true } });
  const count_map = new Map(counts.map((entry) => [entry.ticketTypeId, entry._sum.quantity ?? 0]));
  return api_ok({
    open: new Date() >= event.registrationStartAt && new Date() <= event.registrationEndAt,
    ticket_types: ticket_types.map((ticket) => ({ id: ticket.id, remaining: ticket.quota === null ? null : Math.max(0, ticket.quota - (count_map.get(ticket.id) ?? 0)) })),
  });
}

async function public_ticket(request: NextRequest, ticket_code: string) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) throw new ApiError(404, 'ticket_not_found', 'Tiket tidak ditemukan');
  const ticket = await prisma.ticket.findUnique({ where: { ticketCode: ticket_code }, include: { event: { select: { name: true, startAt: true, locationName: true } } } });
  if (!ticket || sha256(token) !== ticket.qrTokenHash) throw new ApiError(404, 'ticket_not_found', 'Tiket tidak ditemukan');
  return api_ok({ ticket: { ticket_code: ticket.ticketCode, holder_name: ticket.holderName, holder_email: ticket.holderEmail.replace(/(^.).*(@.*$)/, '$1***$2'), status: ticket.status, event: ticket.event } });
}
