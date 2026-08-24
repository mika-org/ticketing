import { NextRequest } from 'next/server';
import { api_error, api_ok } from '@/lib/server/api';
import { require_roles } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await require_roles(request, ['super_admin', 'tenant_admin', 'event_staff']);
    const tenant_scope = auth.context.is_super_admin && !auth.context.tenant_id ? {} : { tenantId: auth.context.tenant_id ?? undefined };
    const [tenants, events, registrations, tickets, check_ins] = await Promise.all([
      auth.context.is_super_admin && !auth.context.tenant_id
        ? prisma.tenant.count({ where: { status: 'active', deletedAt: null } })
        : Promise.resolve(1),
      prisma.event.count({ where: { ...tenant_scope, deletedAt: null } }),
      prisma.registration.count({ where: tenant_scope }),
      prisma.ticket.count({ where: tenant_scope }),
      prisma.checkIn.count({ where: { ...tenant_scope, voidedAt: null } }),
    ]);
    return api_ok({ tenants, events, registrations, tickets, check_ins });
  } catch (error) {
    return api_error(error);
  }
}
