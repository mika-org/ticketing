import { Prisma } from "@prisma/client";
import type { RegistrationInput } from "@/lib/validation";
import { ApiError } from "./api";
import { prisma } from "./prisma";
import { issue_tickets, public_tickets } from "./tickets";
import { verify_password } from "./password";

export async function resolve_public_event(
  tenant_slug: string,
  event_slug: string,
  open = false,
) {
  const event = await prisma.event.findFirst({
    where: {
      slug: event_slug,
      deletedAt: null,
      tenant: { slug: tenant_slug, deletedAt: null },
    },
    include: { tenant: true },
  });
  if (!event || event.status !== "published")
    throw new ApiError(404, "event_not_found", "Event tidak ditemukan");
  if (open) {
    const now = new Date();
    if (event.tenant.status !== "active")
      throw new ApiError(409, "tenant_inactive", "Tenant tidak aktif");
    if (now < event.registrationStartAt || now > event.registrationEndAt)
      throw new ApiError(
        409,
        "event_not_open",
        "Periode pendaftaran sedang tidak dibuka",
      );
  }
  return event;
}

export async function create_registration(
  tenant_slug: string,
  event_slug: string,
  idempotency_key: string,
  input: RegistrationInput,
) {
  if (!idempotency_key || idempotency_key.length > 160)
    throw new ApiError(
      400,
      "idempotency_key_required",
      "Header Idempotency-Key wajib diisi",
    );
  const resolved = await resolve_public_event(tenant_slug, event_slug, true);
  const existing = await prisma.registration.findUnique({
    where: {
      tenantId_eventId_idempotencyKey: {
        tenantId: resolved.tenantId,
        eventId: resolved.id,
        idempotencyKey: idempotency_key,
      },
    },
    include: {
      tickets: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (existing) return registration_result(existing);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resolved.id}))`;
      const ticket_ids = input.items.map((item) => item.ticket_type_id);
      if (ticket_ids.length !== new Set(ticket_ids).size)
        throw new ApiError(
          422,
          "invalid_ticket_selection",
          "Jenis tiket duplikat",
        );
      const ticket_types = await tx.ticketType.findMany({
        where: {
          id: { in: ticket_ids },
          tenantId: resolved.tenantId,
          eventId: resolved.id,
          isActive: true,
          deletedAt: null,
        },
      });
      if (ticket_types.length !== ticket_ids.length)
        throw new ApiError(
          422,
          "invalid_ticket_selection",
          "Jenis tiket tidak valid",
        );
      const items = [];
      for (const selected of input.items) {
        const ticket_type = ticket_types.find(
          (entry) => entry.id === selected.ticket_type_id,
        )!;
        if (
          selected.quantity < ticket_type.minPerOrder ||
          selected.quantity > ticket_type.maxPerOrder
        )
          throw new ApiError(
            422,
            "invalid_ticket_quantity",
            `Jumlah tiket ${ticket_type.name} di luar batas`,
          );
        if (
          ticket_type.visibility === "access_code" &&
          (!selected.access_code ||
            !ticket_type.accessCodeHash ||
            !(await verify_password(
              ticket_type.accessCodeHash,
              selected.access_code,
            )))
        )
          throw new ApiError(
            422,
            "invalid_access_code",
            "Kode akses tiket tidak valid",
          );
        const used = await tx.registrationItem.aggregate({
          where: {
            tenantId: resolved.tenantId,
            ticketTypeId: ticket_type.id,
            registration: {
              status: { in: ["pending", "pending_payment", "confirmed"] },
            },
          },
          _sum: { quantity: true },
        });
        if (
          ticket_type.quota !== null &&
          (used._sum.quantity ?? 0) + selected.quantity > ticket_type.quota
        )
          throw new ApiError(
            409,
            "quota_exceeded",
            `Kuota ${ticket_type.name} tidak tersedia`,
          );
        items.push({ record: ticket_type, quantity: selected.quantity });
      }
      const add_on_ids = (input.add_ons ?? []).map((entry) => entry.add_on_id);
      const add_on_records = await tx.addOn.findMany({
        where: {
          id: { in: add_on_ids },
          tenantId: resolved.tenantId,
          eventId: resolved.id,
          isActive: true,
          deletedAt: null,
        },
        include: { options: { where: { isActive: true, deletedAt: null } } },
      });
      if (add_on_records.length !== new Set(add_on_ids).size)
        throw new ApiError(422, "invalid_add_on", "Add-on tidak valid");
      const add_ons = (input.add_ons ?? []).map((selected) => {
        const add_on = add_on_records.find(
          (entry) => entry.id === selected.add_on_id,
        )!;
        if (
          selected.quantity < add_on.minQuantity ||
          selected.quantity > add_on.maxQuantity
        )
          throw new ApiError(
            422,
            "invalid_add_on_quantity",
            `Jumlah add-on ${add_on.name} di luar batas`,
          );
        const option = selected.add_on_option_id
          ? add_on.options.find(
              (entry) => entry.id === selected.add_on_option_id,
            )
          : undefined;
        if (add_on.selectionType === "single_option" && !option)
          throw new ApiError(
            422,
            "invalid_add_on_option",
            `Opsi ${add_on.name} wajib dipilih`,
          );
        return {
          record: add_on,
          option,
          quantity: selected.quantity,
          unit_price: add_on.price.plus(option?.priceAdjustment ?? 0),
        };
      });
      const fields = await tx.formField.findMany({
        where: {
          tenantId: resolved.tenantId,
          eventId: resolved.id,
          isActive: true,
          deletedAt: null,
        },
        include: { options: { where: { isActive: true, deletedAt: null } } },
      });
      const answer_map = new Map(
        (input.answers ?? []).map((answer) => [
          answer.form_field_id,
          answer.value,
        ]),
      );
      const system_values: Record<string, unknown> = {
        full_name: input.full_name,
        whatsapp_number: input.whatsapp_number,
        email: input.email,
      };
      for (const field of fields) {
        const value = field.isSystem
          ? system_values[field.fieldKey]
          : answer_map.get(field.id);
        if (
          field.isRequired &&
          (value === undefined || value === null || value === "")
        )
          throw new ApiError(
            422,
            "invalid_form_answer",
            `${field.label} wajib diisi`,
          );
        if (
          value !== undefined &&
          ["select", "radio"].includes(field.fieldType) &&
          !field.options.some((option) => option.value === value)
        )
          throw new ApiError(
            422,
            "invalid_form_answer",
            `Pilihan ${field.label} tidak valid`,
          );
      }
      const subtotal = items.reduce(
        (total, item) => total.plus(item.record.price.mul(item.quantity)),
        new Prisma.Decimal(0),
      );
      const add_on_total = add_ons.reduce(
        (total, item) => total.plus(item.unit_price.mul(item.quantity)),
        new Prisma.Decimal(0),
      );
      const total = subtotal.plus(add_on_total);
      const registration = await tx.registration.create({
        data: {
          tenantId: resolved.tenantId,
          eventId: resolved.id,
          registrationCode: `REG-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
          fullName: input.full_name,
          whatsappNumber: input.whatsapp_number,
          email: input.email.toLowerCase(),
          status: total.isZero() ? "confirmed" : "pending_payment",
          subtotalAmount: subtotal,
          addOnAmount: add_on_total,
          totalAmount: total,
          idempotencyKey: idempotency_key,
          source: "web",
          items: {
            create: items.map((item) => ({
              tenantId: resolved.tenantId,
              ticketTypeId: item.record.id,
              quantity: item.quantity,
              unitPrice: item.record.price,
              totalPrice: item.record.price.mul(item.quantity),
            })),
          },
          addOns: {
            create: add_ons.map((item) => ({
              tenantId: resolved.tenantId,
              addOnId: item.record.id,
              addOnOptionId: item.option?.id,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              totalPrice: item.unit_price.mul(item.quantity),
            })),
          },
          answers: {
            create: fields
              .map((field) => ({
                field,
                value: field.isSystem
                  ? system_values[field.fieldKey]
                  : answer_map.get(field.id),
              }))
              .filter((entry) => entry.value !== undefined)
              .map(({ field, value }) => ({
                tenantId: resolved.tenantId,
                formFieldId: field.id,
                answerJson: value as Prisma.InputJsonValue,
                fieldSnapshotJson: {
                  field_key: field.fieldKey,
                  label: field.label,
                  field_type: field.fieldType,
                  options: field.options.map((option) => ({
                    label: option.label,
                    value: option.value,
                  })),
                },
              })),
          },
        },
      });
      if (total.isZero()) await issue_tickets(tx, registration.id);
      else
        await tx.payment.create({
          data: {
            tenantId: resolved.tenantId,
            registrationId: registration.id,
            referenceId: `PAY-${registration.id}`,
            amount: total,
            currency: "IDR",
            status: "pending",
          },
        });
      const complete = await tx.registration.findUniqueOrThrow({
        where: { id: registration.id },
        include: {
          tickets: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      return registration_result(complete);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function registration_result(registration: any) {
  return {
    registration: {
      registration_code: registration.registrationCode,
      status: registration.status,
      total_amount: registration.totalAmount,
      currency: registration.currency,
    },
    payment: registration.payments?.[0]
      ? {
          id: registration.payments[0].id,
          status: registration.payments[0].status,
        }
      : null,
    tickets: public_tickets(registration.tickets ?? []),
  };
}
