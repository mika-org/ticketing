import type { Prisma } from '@prisma/client';
import { sha256, ticket_token } from './crypto';

export async function issue_tickets(tx: Prisma.TransactionClient, registration_id: string) {
  const registration = await tx.registration.findUniqueOrThrow({
    where: { id: registration_id },
    include: { items: true },
  });
  const existing = await tx.ticket.findMany({ where: { registrationId: registration_id } });
  const count_by_item = new Map<string, number>();
  for (const ticket of existing) {
    count_by_item.set(ticket.registrationItemId, (count_by_item.get(ticket.registrationItemId) ?? 0) + 1);
  }
  for (const item of registration.items) {
    for (let index = count_by_item.get(item.id) ?? 0; index < item.quantity; index += 1) {
      const id = crypto.randomUUID();
      await tx.ticket.create({
        data: {
          id,
          tenantId: registration.tenantId,
          eventId: registration.eventId,
          registrationId: registration.id,
          registrationItemId: item.id,
          ticketCode: `TKT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          qrTokenHash: sha256(ticket_token(id)),
          holderName: registration.fullName,
          holderEmail: registration.email,
          status: 'issued',
        },
      });
    }
  }
  return tx.ticket.findMany({ where: { registrationId: registration_id }, orderBy: { createdAt: 'asc' } });
}

export function public_tickets(tickets: Array<{ id: string; ticketCode: string; holderName: string; status: string }>) {
  return tickets.map((ticket) => ({
    ticket_code: ticket.ticketCode,
    holder_name: ticket.holderName,
    status: ticket.status,
    qr_token: ticket_token(ticket.id),
  }));
}
