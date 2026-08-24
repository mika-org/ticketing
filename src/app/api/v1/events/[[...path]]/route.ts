import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { require_tenant, type AuthContext } from "@/lib/server/auth";
import {
  ApiError,
  api_error,
  api_ok,
  assert_same_origin,
  pagination,
  parse_body,
} from "@/lib/server/api";
import { sha256 } from "@/lib/server/crypto";
import {
  build_event_report_workbook,
  get_event_financial_report,
  parse_event_report_range,
} from "@/lib/server/event_reports";
import { cancel_active_xendit_payment_requests } from "@/lib/server/payments";
import { hash_password } from "@/lib/server/password";
import { prisma } from "@/lib/server/prisma";
import { issue_tickets, public_tickets } from "@/lib/server/tickets";
import {
  add_on_schema,
  event_schema,
  form_field_schema,
  manual_settlement_schema,
  ticket_type_schema,
  uuid_schema,
} from "@/lib/validation";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ path?: string[] }> };

const admin_roles: NonNullable<AuthContext["role"]>[] = [
  "super_admin",
  "tenant_admin",
];
const scanner_token_schema = z
  .string()
  .trim()
  .min(8, "Token atau kode tiket terlalu pendek")
  .max(2048, "Token atau kode tiket terlalu panjang");

export async function GET(request: NextRequest, route_context: RouteContext) {
  try {
    const auth = await require_tenant(request);
    const path = (await route_context.params).path ?? [];
    if (path.length === 0) return list_events(request, auth);
    const event_id = uuid_schema.parse(path[0]);
    await assert_event(auth, event_id);
    if (path.length === 1) return get_event(auth, event_id);
    if (path[1] === "ticket-types") return list_ticket_types(auth, event_id);
    if (path[1] === "add-ons") return list_add_ons(auth, event_id);
    if (path[1] === "form-fields") return list_form_fields(auth, event_id);
    if (path[1] === "public-link") return public_link(auth, event_id);
    if (path[1] === "registrations" && path.length === 2)
      return await list_registrations(request, auth, event_id);
    if (path[1] === "registrations" && path.length === 3)
      return get_registration(auth, event_id, uuid_schema.parse(path[2]));
    if (path[1] === "tickets") return list_tickets(request, auth, event_id);
    if (path[1] === "reports" && path[2] === "summary")
      return await report_summary(request, auth, event_id);
    if (path[1] === "reports" && path[2] === "export")
      return await export_event_report(request, auth, event_id);
    if (path[1] === "payments") return list_payments(request, auth, event_id);
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

export async function POST(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const path = (await route_context.params).path ?? [];
    if (path.length === 0) {
      const auth = await require_tenant(request, admin_roles);
      return create_event(request, auth);
    }
    const event_id = uuid_schema.parse(path[0]);
    const operational = path[1] === "check-ins";
    const auth = await require_tenant(
      request,
      operational
        ? ["super_admin", "tenant_admin", "event_staff"]
        : admin_roles,
    );
    await assert_event(auth, event_id);
    if (path[1] === "publish")
      return set_event_status(auth, event_id, "published");
    if (path[1] === "close") return set_event_status(auth, event_id, "closed");
    if (path[1] === "ticket-types" && path.length === 2)
      return create_ticket_type(request, auth, event_id);
    if (path[1] === "add-ons" && path.length === 2)
      return create_add_on(request, auth, event_id);
    if (path[1] === "form-fields" && path.length === 2)
      return create_form_field(request, auth, event_id);
    if (path[1] === "registrations" && path[3] === "issue-tickets") {
      return issue_registration_tickets(
        auth,
        event_id,
        uuid_schema.parse(path[2]),
      );
    }
    if (
      path[1] === "registrations" &&
      path[3] === "manual-settlement" &&
      path.length === 4
    ) {
      return await settle_registration_ots(
        request,
        auth,
        event_id,
        uuid_schema.parse(path[2]),
      );
    }
    if (path[1] === "check-ins" && path[2] === "validate")
      return await validate_ticket(request, auth, event_id);
    if (path[1] === "check-ins" && path.length === 2)
      return await check_in(request, auth, event_id);
    if (path[1] === "check-ins" && path[3] === "void")
      return await void_check_in(
        request,
        auth,
        event_id,
        uuid_schema.parse(path[2]),
      );
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

export async function PATCH(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const auth = await require_tenant(request, admin_roles);
    const path = (await route_context.params).path ?? [];
    const event_id = uuid_schema.parse(path[0]);
    await assert_event(auth, event_id);
    if (path.length === 1) return update_event(request, auth, event_id);
    if (path[1] === "ticket-types")
      return update_ticket_type(
        request,
        auth,
        event_id,
        uuid_schema.parse(path[2]),
      );
    if (path[1] === "add-ons")
      return update_add_on(request, auth, event_id, uuid_schema.parse(path[2]));
    if (path[1] === "form-fields")
      return update_form_field(
        request,
        auth,
        event_id,
        uuid_schema.parse(path[2]),
      );
    if (path[1] === "registrations" && path[3] === "status") {
      return update_registration_status(
        request,
        auth,
        event_id,
        uuid_schema.parse(path[2]),
      );
    }
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

export async function DELETE(
  request: NextRequest,
  route_context: RouteContext,
) {
  try {
    assert_same_origin(request);
    const auth = await require_tenant(request, admin_roles);
    const path = (await route_context.params).path ?? [];
    const event_id = uuid_schema.parse(path[0]);
    await assert_event(auth, event_id);
    const id = uuid_schema.parse(path[2]);
    if (path[1] === "ticket-types")
      return soft_delete(auth, "ticket_type", id, event_id);
    if (path[1] === "add-ons") return soft_delete(auth, "add_on", id, event_id);
    if (path[1] === "form-fields")
      return soft_delete(auth, "form_field", id, event_id);
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

export async function PUT(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const auth = await require_tenant(request, admin_roles);
    const path = (await route_context.params).path ?? [];
    const event_id = uuid_schema.parse(path[0]);
    await assert_event(auth, event_id);
    if (path[1] === "form-fields" && path[2] === "reorder")
      return reorder_form_fields(request, auth, event_id);
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

type TenantAuth = Awaited<ReturnType<typeof require_tenant>>;

async function assert_event(auth: TenantAuth, event_id: string) {
  const event = await prisma.event.findFirst({
    where: { id: event_id, tenantId: auth.tenant_id, deletedAt: null },
  });
  if (!event)
    throw new ApiError(404, "event_not_found", "Event tidak ditemukan");
  if (auth.context.role === "event_staff") {
    const assigned = await prisma.eventStaffAssignment.findFirst({
      where: {
        tenantId: auth.tenant_id,
        eventId: event_id,
        userId: auth.context.sub,
      },
    });
    if (!assigned)
      throw new ApiError(
        403,
        "event_not_assigned",
        "Petugas tidak ditugaskan pada event ini",
      );
  }
  return event;
}

async function list_events(request: NextRequest, auth: TenantAuth) {
  const query = pagination(request);
  const where: Prisma.EventWhereInput = {
    tenantId: auth.tenant_id,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { slug: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(auth.context.role === "event_staff"
      ? { staffAssignments: { some: { userId: auth.context.sub } } }
      : {}),
  };
  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: { _count: { select: { registrations: true, tickets: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.per_page,
      take: query.per_page,
    }),
    prisma.event.count({ where }),
  ]);
  return api_ok(
    { events },
    { page: query.page, per_page: query.per_page, total },
  );
}

async function get_event(auth: TenantAuth, event_id: string) {
  const event = await prisma.event.findFirst({
    where: { id: event_id, tenantId: auth.tenant_id, deletedAt: null },
    include: {
      _count: {
        select: {
          registrations: true,
          tickets: true,
          ticketTypes: true,
          addOns: true,
        },
      },
    },
  });
  if (!event)
    throw new ApiError(404, "event_not_found", "Event tidak ditemukan");
  return api_ok({ event });
}

async function create_event(request: NextRequest, auth: TenantAuth) {
  const input = await parse_body(request, event_schema);
  const duplicate = await prisma.event.findFirst({
    where: { tenantId: auth.tenant_id, slug: input.slug, deletedAt: null },
  });
  if (duplicate)
    throw new ApiError(
      409,
      "duplicate_event_slug",
      "Slug event sudah digunakan",
    );
  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        tenantId: auth.tenant_id,
        createdBy: auth.context.sub,
        name: input.name,
        slug: input.slug,
        shortDescription: input.short_description,
        description: input.description,
        bannerUrl: input.banner_url || undefined,
        locationType: input.location_type,
        locationName: input.location_name,
        locationAddress: input.location_address,
        meetingUrl: input.meeting_url || undefined,
        startAt: new Date(input.start_at),
        endAt: new Date(input.end_at),
        timezone: input.timezone,
        registrationStartAt: new Date(input.registration_start_at),
        registrationEndAt: new Date(input.registration_end_at),
        capacity: input.capacity,
        organizerName: input.organizer_name,
        organizerContact: input.organizer_contact,
        termsText: input.terms_text,
        privacyText: input.privacy_text,
      },
    });
    await tx.formField.createMany({
      data: [
        {
          tenantId: auth.tenant_id,
          eventId: created.id,
          fieldKey: "full_name",
          label: "Nama lengkap",
          fieldType: "text",
          isRequired: true,
          isSystem: true,
          sortOrder: 0,
        },
        {
          tenantId: auth.tenant_id,
          eventId: created.id,
          fieldKey: "whatsapp_number",
          label: "Nomor WhatsApp",
          fieldType: "phone",
          isRequired: true,
          isSystem: true,
          sortOrder: 1,
        },
        {
          tenantId: auth.tenant_id,
          eventId: created.id,
          fieldKey: "email",
          label: "Email",
          fieldType: "email",
          isRequired: true,
          isSystem: true,
          sortOrder: 2,
        },
      ],
    });
    return created;
  });
  await audit(auth, "event.created", "event", event.id, undefined, {
    name: event.name,
    slug: event.slug,
  });
  return api_ok({ event }, undefined, 201);
}

async function update_event(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const schema = event_schema.partial();
  const input = await parse_body(request, schema);
  const before = await assert_event(auth, event_id);
  const event = await prisma.event.update({
    where: { id: event_id },
    data: {
      name: input.name,
      shortDescription: input.short_description,
      description: input.description,
      bannerUrl: input.banner_url || undefined,
      locationType: input.location_type,
      locationName: input.location_name,
      locationAddress: input.location_address,
      meetingUrl: input.meeting_url || undefined,
      startAt: input.start_at ? new Date(input.start_at) : undefined,
      endAt: input.end_at ? new Date(input.end_at) : undefined,
      timezone: input.timezone,
      registrationStartAt: input.registration_start_at
        ? new Date(input.registration_start_at)
        : undefined,
      registrationEndAt: input.registration_end_at
        ? new Date(input.registration_end_at)
        : undefined,
      capacity: input.capacity,
      organizerName: input.organizer_name,
      organizerContact: input.organizer_contact,
      termsText: input.terms_text,
      privacyText: input.privacy_text,
      updatedBy: auth.context.sub,
    },
  });
  await audit(auth, "event.updated", "event", event_id, before, event);
  return api_ok({ event });
}

async function set_event_status(
  auth: TenantAuth,
  event_id: string,
  status: "published" | "closed",
) {
  const event = await assert_event(auth, event_id);
  if (status === "published") {
    const count = await prisma.ticketType.count({
      where: {
        tenantId: auth.tenant_id,
        eventId: event_id,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!count)
      throw new ApiError(
        422,
        "event_configuration_invalid",
        "Event memerlukan minimal satu jenis tiket aktif",
      );
  }
  const updated = await prisma.event.update({
    where: { id: event_id },
    data: {
      status,
      publishedAt: status === "published" ? new Date() : undefined,
      updatedBy: auth.context.sub,
    },
  });
  await audit(auth, `event.${status}`, "event", event_id, event, updated);
  return api_ok({ event: updated });
}

async function public_link(auth: TenantAuth, event_id: string) {
  const [event, tenant] = await Promise.all([
    assert_event(auth, event_id),
    prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenant_id } }),
  ]);
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return api_ok({ url: `${origin}/e/${tenant.slug}/${event.slug}` });
}

async function list_ticket_types(auth: TenantAuth, event_id: string) {
  const ticket_types = await prisma.ticketType.findMany({
    where: { tenantId: auth.tenant_id, eventId: event_id, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return api_ok({ ticket_types });
}

async function create_ticket_type(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const input = await parse_body(request, ticket_type_schema);
  const duplicate = await prisma.ticketType.findFirst({
    where: {
      tenantId: auth.tenant_id,
      eventId: event_id,
      slug: input.slug,
      deletedAt: null,
    },
  });
  if (duplicate)
    throw new ApiError(
      409,
      "duplicate_ticket_slug",
      "Slug jenis tiket sudah digunakan",
    );
  const ticket_type = await prisma.ticketType.create({
    data: {
      tenantId: auth.tenant_id,
      eventId: event_id,
      name: input.name,
      slug: input.slug,
      description: input.description,
      price: new Prisma.Decimal(input.price),
      currency: input.currency,
      quota: input.quota,
      minPerOrder: input.min_per_order,
      maxPerOrder: input.max_per_order,
      visibility: input.visibility,
      accessCodeHash: input.access_code
        ? await hash_password(input.access_code)
        : undefined,
      sortOrder: input.sort_order,
      isActive: input.is_active,
    },
  });
  await audit(auth, "ticket_type.created", "ticket_type", ticket_type.id);
  return api_ok({ ticket_type }, undefined, 201);
}

async function update_ticket_type(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
  id: string,
) {
  const input = await parse_body(request, ticket_type_schema.partial());
  const before = await prisma.ticketType.findFirst({
    where: { id, tenantId: auth.tenant_id, eventId: event_id, deletedAt: null },
  });
  if (!before)
    throw new ApiError(
      404,
      "ticket_type_not_found",
      "Jenis tiket tidak ditemukan",
    );
  const ticket_type = await prisma.ticketType.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      price:
        input.price === undefined ? undefined : new Prisma.Decimal(input.price),
      quota: input.quota,
      minPerOrder: input.min_per_order,
      maxPerOrder: input.max_per_order,
      visibility: input.visibility,
      accessCodeHash: input.access_code
        ? await hash_password(input.access_code)
        : undefined,
      sortOrder: input.sort_order,
      isActive: input.is_active,
    },
  });
  await audit(
    auth,
    "ticket_type.updated",
    "ticket_type",
    id,
    before,
    ticket_type,
  );
  return api_ok({ ticket_type });
}

async function list_add_ons(auth: TenantAuth, event_id: string) {
  const add_ons = await prisma.addOn.findMany({
    where: { tenantId: auth.tenant_id, eventId: event_id, deletedAt: null },
    include: {
      options: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      ticketTypeLinks: { select: { ticketTypeId: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return api_ok({ add_ons });
}

async function create_add_on(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const input = await parse_body(request, add_on_schema);
  const add_on = await prisma.addOn.create({
    data: {
      tenantId: auth.tenant_id,
      eventId: event_id,
      name: input.name,
      slug: input.slug,
      description: input.description,
      price: new Prisma.Decimal(input.price),
      quota: input.quota,
      selectionType: input.selection_type,
      minQuantity: input.min_quantity,
      maxQuantity: input.max_quantity,
      isRequired: input.is_required,
      sortOrder: input.sort_order,
      isActive: input.is_active,
      options: {
        create: input.options?.map((option) => ({
          tenantId: auth.tenant_id,
          label: option.label,
          value: option.value,
          priceAdjustment: new Prisma.Decimal(option.price_adjustment),
          quota: option.quota,
          sortOrder: option.sort_order,
        })),
      },
      ticketTypeLinks: {
        create: input.ticket_type_ids?.map((ticketTypeId) => ({
          tenantId: auth.tenant_id,
          ticketTypeId,
        })),
      },
    },
    include: { options: true, ticketTypeLinks: true },
  });
  await audit(auth, "add_on.created", "add_on", add_on.id);
  return api_ok({ add_on }, undefined, 201);
}

async function update_add_on(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
  id: string,
) {
  const input = await parse_body(request, add_on_schema.partial());
  const before = await prisma.addOn.findFirst({
    where: { id, tenantId: auth.tenant_id, eventId: event_id, deletedAt: null },
  });
  if (!before)
    throw new ApiError(404, "add_on_not_found", "Add-on tidak ditemukan");
  const add_on = await prisma.$transaction(async (tx) => {
    if (input.ticket_type_ids) {
      await tx.ticketTypeAddOn.deleteMany({
        where: { tenantId: auth.tenant_id, addOnId: id },
      });
      await tx.ticketTypeAddOn.createMany({
        data: input.ticket_type_ids.map((ticketTypeId) => ({
          tenantId: auth.tenant_id,
          addOnId: id,
          ticketTypeId,
        })),
      });
    }
    if (input.options) {
      await tx.addOnOption.updateMany({
        where: { tenantId: auth.tenant_id, addOnId: id, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.addOnOption.createMany({
        data: input.options.map((option) => ({
          tenantId: auth.tenant_id,
          addOnId: id,
          label: option.label,
          value: option.value,
          priceAdjustment: new Prisma.Decimal(option.price_adjustment),
          quota: option.quota,
          sortOrder: option.sort_order,
        })),
      });
    }
    return tx.addOn.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        price:
          input.price === undefined
            ? undefined
            : new Prisma.Decimal(input.price),
        quota: input.quota,
        selectionType: input.selection_type,
        minQuantity: input.min_quantity,
        maxQuantity: input.max_quantity,
        isRequired: input.is_required,
        sortOrder: input.sort_order,
        isActive: input.is_active,
      },
      include: {
        options: { where: { deletedAt: null } },
        ticketTypeLinks: true,
      },
    });
  });
  await audit(auth, "add_on.updated", "add_on", id, before, add_on);
  return api_ok({ add_on });
}

async function list_form_fields(auth: TenantAuth, event_id: string) {
  const form_fields = await prisma.formField.findMany({
    where: { tenantId: auth.tenant_id, eventId: event_id, deletedAt: null },
    include: {
      options: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return api_ok({ form_fields });
}

async function create_form_field(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const input = await parse_body(request, form_field_schema);
  const duplicate = await prisma.formField.findFirst({
    where: {
      tenantId: auth.tenant_id,
      eventId: event_id,
      fieldKey: input.field_key,
      deletedAt: null,
    },
  });
  if (duplicate)
    throw new ApiError(409, "duplicate_field_key", "Field key sudah digunakan");
  const form_field = await prisma.formField.create({
    data: {
      tenantId: auth.tenant_id,
      eventId: event_id,
      ticketTypeId: input.ticket_type_id,
      fieldKey: input.field_key,
      label: input.label,
      fieldType: input.field_type,
      placeholder: input.placeholder,
      helpText: input.help_text,
      validationJson: input.validation_json as Prisma.InputJsonValue,
      conditionalLogicJson:
        input.conditional_logic_json as Prisma.InputJsonValue,
      sortOrder: input.sort_order,
      isRequired: input.is_required,
      isActive: input.is_active,
      options: {
        create: input.options?.map((option) => ({
          tenantId: auth.tenant_id,
          label: option.label,
          value: option.value,
          sortOrder: option.sort_order,
        })),
      },
    },
    include: { options: true },
  });
  await audit(auth, "form_field.created", "form_field", form_field.id);
  return api_ok({ form_field }, undefined, 201);
}

async function update_form_field(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
  id: string,
) {
  const input = await parse_body(
    request,
    form_field_schema.partial().omit({ field_key: true }),
  );
  const before = await prisma.formField.findFirst({
    where: { id, tenantId: auth.tenant_id, eventId: event_id, deletedAt: null },
  });
  if (!before)
    throw new ApiError(
      404,
      "form_field_not_found",
      "Field form tidak ditemukan",
    );
  if (
    before.isSystem &&
    (input.is_active === false || input.is_required === false)
  ) {
    throw new ApiError(
      422,
      "system_field_protected",
      "Field sistem wajib aktif dan required",
    );
  }
  const form_field = await prisma.$transaction(async (tx) => {
    if (input.options) {
      await tx.formFieldOption.updateMany({
        where: { tenantId: auth.tenant_id, formFieldId: id, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.formFieldOption.createMany({
        data: input.options.map((option) => ({
          tenantId: auth.tenant_id,
          formFieldId: id,
          label: option.label,
          value: option.value,
          sortOrder: option.sort_order,
        })),
      });
    }
    return tx.formField.update({
      where: { id },
      data: {
        ticketTypeId: input.ticket_type_id,
        label: input.label,
        fieldType: input.field_type,
        placeholder: input.placeholder,
        helpText: input.help_text,
        validationJson: input.validation_json as Prisma.InputJsonValue,
        conditionalLogicJson:
          input.conditional_logic_json as Prisma.InputJsonValue,
        sortOrder: input.sort_order,
        isRequired: input.is_required,
        isActive: input.is_active,
      },
      include: { options: { where: { deletedAt: null } } },
    });
  });
  await audit(auth, "form_field.updated", "form_field", id, before, form_field);
  return api_ok({ form_field });
}

async function reorder_form_fields(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const input = await parse_body(
    request,
    z
      .object({
        fields: z
          .array(
            z.object({
              id: uuid_schema,
              sort_order: z.number().int().nonnegative(),
            }),
          )
          .max(200),
      })
      .strict(),
  );
  const count = await prisma.formField.count({
    where: {
      id: { in: input.fields.map((field) => field.id) },
      tenantId: auth.tenant_id,
      eventId: event_id,
      deletedAt: null,
    },
  });
  if (count !== new Set(input.fields.map((field) => field.id)).size)
    throw new ApiError(
      422,
      "invalid_form_field",
      "Satu atau lebih field tidak valid",
    );
  await prisma.$transaction(
    input.fields.map((field) =>
      prisma.formField.update({
        where: { id: field.id },
        data: { sortOrder: field.sort_order },
      }),
    ),
  );
  return api_ok({ reordered: true });
}

async function soft_delete(
  auth: TenantAuth,
  resource: "ticket_type" | "add_on" | "form_field",
  id: string,
  event_id: string,
) {
  if (resource === "ticket_type") {
    const record = await prisma.ticketType.findFirst({
      where: {
        id,
        tenantId: auth.tenant_id,
        eventId: event_id,
        deletedAt: null,
      },
    });
    if (!record)
      throw new ApiError(
        404,
        "ticket_type_not_found",
        "Jenis tiket tidak ditemukan",
      );
    await prisma.ticketType.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  } else if (resource === "add_on") {
    const record = await prisma.addOn.findFirst({
      where: {
        id,
        tenantId: auth.tenant_id,
        eventId: event_id,
        deletedAt: null,
      },
    });
    if (!record)
      throw new ApiError(404, "add_on_not_found", "Add-on tidak ditemukan");
    await prisma.addOn.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  } else {
    const record = await prisma.formField.findFirst({
      where: {
        id,
        tenantId: auth.tenant_id,
        eventId: event_id,
        deletedAt: null,
      },
    });
    if (!record)
      throw new ApiError(
        404,
        "form_field_not_found",
        "Field form tidak ditemukan",
      );
    if (record.isSystem)
      throw new ApiError(
        422,
        "system_field_protected",
        "Field sistem tidak dapat dihapus",
      );
    await prisma.formField.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
  await audit(auth, `${resource}.deleted`, resource, id);
  return api_ok({ deleted: true });
}

async function list_registrations(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const query = pagination(request);
  const range = parse_event_report_range(request);
  const where: Prisma.RegistrationWhereInput = {
    tenantId: auth.tenant_id,
    eventId: event_id,
    ...(range.from || range.to
      ? {
          registeredAt: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            {
              fullName: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            { email: { contains: query.search, mode: "insensitive" as const } },
            {
              registrationCode: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
  const [registrations, total] = await prisma.$transaction([
    prisma.registration.findMany({
      where,
      include: {
        _count: { select: { tickets: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.per_page,
      take: query.per_page,
    }),
    prisma.registration.count({ where }),
  ]);
  return api_ok(
    { registrations },
    { page: query.page, per_page: query.per_page, total },
  );
}

async function get_registration(
  auth: TenantAuth,
  event_id: string,
  registration_id: string,
) {
  const registration = await prisma.registration.findFirst({
    where: { id: registration_id, tenantId: auth.tenant_id, eventId: event_id },
    include: {
      items: { include: { ticketType: true } },
      addOns: { include: { addOn: true, addOnOption: true } },
      answers: true,
      tickets: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!registration)
    throw new ApiError(
      404,
      "registration_not_found",
      "Pendaftaran tidak ditemukan",
    );
  return api_ok({ registration });
}

async function update_registration_status(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
  registration_id: string,
) {
  const input = await parse_body(
    request,
    z
      .object({
        status: z.enum([
          "pending",
          "pending_payment",
          "confirmed",
          "cancelled",
          "expired",
          "rejected",
        ]),
        reason: z.string().max(500).optional(),
      })
      .strict(),
  );
  const before = await prisma.registration.findFirst({
    where: { id: registration_id, tenantId: auth.tenant_id, eventId: event_id },
  });
  if (!before)
    throw new ApiError(
      404,
      "registration_not_found",
      "Pendaftaran tidak ditemukan",
    );
  if (input.status === "confirmed" && !before.totalAmount.isZero())
    throw new ApiError(
      422,
      "payment_confirmation_required",
      "Pendaftaran berbayar hanya dikonfirmasi dari pembayaran tervalidasi",
    );
  const registration = await prisma.registration.update({
    where: { id: registration_id },
    data: {
      status: input.status,
      cancelledAt: input.status === "cancelled" ? new Date() : undefined,
    },
  });
  await audit(
    auth,
    "registration.status_changed",
    "registration",
    registration_id,
    { status: before.status },
    { status: input.status, reason: input.reason },
  );
  return api_ok({ registration });
}

async function issue_registration_tickets(
  auth: TenantAuth,
  event_id: string,
  registration_id: string,
) {
  const registration = await prisma.registration.findFirst({
    where: { id: registration_id, tenantId: auth.tenant_id, eventId: event_id },
  });
  if (!registration)
    throw new ApiError(
      404,
      "registration_not_found",
      "Pendaftaran tidak ditemukan",
    );
  if (registration.status !== "confirmed")
    throw new ApiError(
      422,
      "registration_not_confirmed",
      "Pendaftaran belum dikonfirmasi",
    );
  const tickets = await prisma.$transaction((tx) =>
    issue_tickets(tx, registration_id),
  );
  return api_ok({ tickets: public_tickets(tickets) });
}

async function settle_registration_ots(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
  registration_id: string,
) {
  const input = await parse_body(request, manual_settlement_schema);
  await cancel_active_xendit_payment_requests(auth.tenant_id, registration_id);
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${registration_id}))`;
      const registration = await tx.registration.findFirst({
        where: {
          id: registration_id,
          tenantId: auth.tenant_id,
          eventId: event_id,
        },
        include: {
          payments: { orderBy: { createdAt: "desc" } },
          tickets: true,
        },
      });
      if (!registration)
        throw new ApiError(
          404,
          "registration_not_found",
          "Pendaftaran tidak ditemukan",
        );

      const existing_manual = registration.payments.find(
        (payment) =>
          payment.provider === "manual" && payment.status === "succeeded",
      );
      if (existing_manual) {
        return {
          payment: existing_manual,
          ticket_count: registration.tickets.length,
          duplicate: true,
        };
      }
      if (
        registration.status === "confirmed" ||
        registration.payments.some((payment) => payment.status === "succeeded")
      ) {
        throw new ApiError(
          409,
          "registration_already_paid",
          "Pendaftaran sudah memiliki pembayaran berhasil",
        );
      }
      if (
        !["pending", "pending_payment", "expired"].includes(registration.status)
      ) {
        throw new ApiError(
          422,
          "manual_settlement_not_allowed",
          "Status pendaftaran tidak dapat diselesaikan secara OTS",
        );
      }
      if (registration.totalAmount.isZero()) {
        throw new ApiError(
          422,
          "manual_settlement_not_required",
          "Pendaftaran gratis tidak memerlukan settlement",
        );
      }

      await tx.payment.updateMany({
        where: {
          tenantId: auth.tenant_id,
          registrationId: registration.id,
          provider: "xendit",
          status: { in: ["pending", "requires_action"] },
        },
        data: {
          status: "failed",
          failureCode: "replaced_by_manual_ots",
          qrStringEncrypted: null,
          lastCheckedAt: new Date(),
        },
      });

      const payment = await tx.payment.create({
        data: {
          tenantId: auth.tenant_id,
          registrationId: registration.id,
          provider: "manual",
          paymentMethod: `OTS_${input.payment_method.toUpperCase()}`,
          referenceId: `OTS-${registration.id}`,
          amount: registration.totalAmount,
          currency: registration.currency,
          status: "succeeded",
          paidAt: new Date(),
          lastCheckedAt: new Date(),
          settledByUserId: auth.context.sub,
          manualReference: input.reference_number,
          settlementNotes: input.notes,
        },
      });
      await tx.registration.update({
        where: { id: registration.id },
        data: { status: "confirmed" },
      });
      const tickets = await issue_tickets(tx, registration.id);
      await tx.auditLog.create({
        data: {
          tenantId: auth.tenant_id,
          actorUserId: auth.context.sub,
          actorRole: auth.context.role,
          action: "registration.manual_settlement",
          entityType: "registration",
          entityId: registration.id,
          beforeJson: { status: registration.status } as Prisma.InputJsonValue,
          afterJson: {
            status: "confirmed",
            provider: "manual",
            payment_method: input.payment_method,
            amount: registration.totalAmount.toString(),
            reference_number: input.reference_number ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return { payment, ticket_count: tickets.length, duplicate: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return api_ok(result, undefined, result.duplicate ? 200 : 201);
}

async function list_tickets(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const query = pagination(request);
  const where: Prisma.TicketWhereInput = {
    tenantId: auth.tenant_id,
    eventId: event_id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            {
              ticketCode: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              holderName: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      include: {
        registration: { select: { registrationCode: true } },
        checkIns: { where: { voidedAt: null }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.per_page,
      take: query.per_page,
    }),
    prisma.ticket.count({ where }),
  ]);
  return api_ok(
    { tickets },
    { page: query.page, per_page: query.per_page, total },
  );
}

async function validate_ticket(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const input = await parse_body(
    request,
    z.object({ token: scanner_token_schema }).strict(),
  );
  const ticket = await resolve_scanned_ticket(auth, event_id, input.token);
  const check_in = ticket.checkIns[0];
  const latest_payment = ticket.registration.payments[0];
  return api_ok({
    valid: ticket.status === "issued" && !check_in,
    ticket: {
      ticket_code: ticket.ticketCode,
      holder_name: ticket.holderName,
      status: ticket.status,
      checked_in_at: check_in?.checkedInAt ?? null,
    },
    ticket_type: {
      id: ticket.registrationItem.ticketType.id,
      name: ticket.registrationItem.ticketType.name,
      quantity: ticket.registrationItem.quantity,
      unit_price: Number(ticket.registrationItem.unitPrice),
      total_price: Number(ticket.registrationItem.totalPrice),
      currency: ticket.registrationItem.ticketType.currency,
    },
    registration: {
      registration_code: ticket.registration.registrationCode,
      status: ticket.registration.status,
      email: ticket.registration.email,
      whatsapp_number: ticket.registration.whatsappNumber,
      total_amount: Number(ticket.registration.totalAmount),
      currency: ticket.registration.currency,
    },
    add_ons: ticket.registration.addOns.map((item) => ({
      id: item.id,
      name: item.addOn.name,
      option: item.addOnOption?.label ?? null,
      quantity: item.quantity,
      unit_price: Number(item.unitPrice),
      total_price: Number(item.totalPrice),
      currency: item.addOn.currency,
    })),
    payment: latest_payment
      ? {
          provider: latest_payment.provider,
          method: latest_payment.paymentMethod,
          status: latest_payment.status,
          paid_at: latest_payment.paidAt,
          reference: latest_payment.manualReference,
        }
      : null,
    reason: check_in
      ? "ticket_already_checked_in"
      : ticket.status !== "issued"
        ? `ticket_${ticket.status}`
        : null,
  });
}

async function check_in(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const input = await parse_body(
    request,
    z
      .object({
        token: scanner_token_schema,
        sync_key: z.string().min(8).max(160),
        device_id: z.string().max(160).optional(),
        notes: z.string().max(1000).optional(),
        source: z
          .enum(["web", "ionic_online", "ionic_offline_sync"])
          .default("web"),
      })
      .strict(),
  );
  const duplicate = await prisma.checkIn.findUnique({
    where: { syncKey: input.sync_key },
  });
  if (duplicate) {
    if (duplicate.tenantId !== auth.tenant_id || duplicate.eventId !== event_id)
      throw new ApiError(
        409,
        "tenant_scope_violation",
        "Sync key sudah digunakan pada scope lain",
      );
    return api_ok({ check_in: duplicate, duplicate: true });
  }
  const ticket = await resolve_scanned_ticket(auth, event_id, input.token);
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ticket.id}))`;
      const current = await tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      const active = await tx.checkIn.findFirst({
        where: {
          tenantId: auth.tenant_id,
          ticketId: ticket.id,
          voidedAt: null,
        },
      });
      if (current.status !== "issued" || active)
        throw new ApiError(
          409,
          "ticket_already_checked_in",
          "Tiket sudah digunakan atau tidak aktif",
        );
      const check_in = await tx.checkIn.create({
        data: {
          tenantId: auth.tenant_id,
          eventId: event_id,
          ticketId: ticket.id,
          checkedInBy: auth.context.sub,
          source: input.source,
          deviceId: input.device_id,
          syncKey: input.sync_key,
          notes: input.notes,
        },
      });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: "checked_in" },
      });
      return {
        check_in,
        ticket: { ticket_code: ticket.ticketCode, status: "checked_in" },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return api_ok(result, undefined, 201);
}

async function resolve_scanned_ticket(
  auth: TenantAuth,
  event_id: string,
  raw_input: string,
) {
  const input = normalize_scanner_input(raw_input);
  const is_registration_code = /^REG-/i.test(input);
  const is_ticket_code = /^TKT-/i.test(input);
  const tickets = await prisma.ticket.findMany({
    where: {
      tenantId: auth.tenant_id,
      eventId: event_id,
      ...(is_registration_code
        ? {
            registration: {
              registrationCode: { equals: input, mode: "insensitive" },
            },
          }
        : is_ticket_code
          ? { ticketCode: { equals: input, mode: "insensitive" } }
          : { qrTokenHash: sha256(input) }),
    },
    include: {
      checkIns: { where: { voidedAt: null }, take: 1 },
      registrationItem: {
        include: {
          ticketType: {
            select: { id: true, name: true, currency: true },
          },
        },
      },
      registration: {
        select: {
          registrationCode: true,
          status: true,
          email: true,
          whatsappNumber: true,
          totalAmount: true,
          currency: true,
          addOns: {
            include: {
              addOn: {
                select: { name: true, currency: true },
              },
              addOnOption: { select: { label: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          payments: {
            select: {
              provider: true,
              paymentMethod: true,
              status: true,
              paidAt: true,
              manualReference: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    take: is_registration_code ? 2 : 1,
  });
  if (!tickets.length) {
    throw new ApiError(
      404,
      "ticket_not_found",
      "Tiket tidak ditemukan untuk event ini",
    );
  }
  if (is_registration_code && tickets.length > 1) {
    throw new ApiError(
      409,
      "registration_has_multiple_tickets",
      "Pendaftaran memiliki beberapa tiket; scan QR atau masukkan kode TKT tiket yang dipilih",
    );
  }
  return tickets[0];
}

function normalize_scanner_input(value: string) {
  const input = value.trim();
  if (!/^https?:\/\//i.test(input)) return input;
  try {
    const url = new URL(input);
    return url.searchParams.get("token")?.trim() || input;
  } catch {
    return input;
  }
}

async function void_check_in(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
  check_in_id: string,
) {
  const input = await parse_body(
    request,
    z.object({ reason: z.string().min(3).max(500) }).strict(),
  );
  const check_in = await prisma.checkIn.findFirst({
    where: {
      id: check_in_id,
      tenantId: auth.tenant_id,
      eventId: event_id,
      voidedAt: null,
    },
  });
  if (!check_in)
    throw new ApiError(
      404,
      "check_in_not_found",
      "Check-in aktif tidak ditemukan",
    );
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.checkIn.update({
      where: { id: check_in.id },
      data: {
        voidedAt: new Date(),
        voidedBy: auth.context.sub,
        notes: [check_in.notes, `VOID: ${input.reason}`]
          .filter(Boolean)
          .join("\n"),
      },
    });
    await tx.ticket.update({
      where: { id: check_in.ticketId },
      data: { status: "issued" },
    });
    return record;
  });
  return api_ok({ check_in: updated });
}

async function report_summary(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const report = await get_event_financial_report(
    auth.tenant_id,
    event_id,
    parse_event_report_range(request),
  );
  return api_ok(report);
}

async function export_event_report(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const report = await build_event_report_workbook(
    auth.tenant_id,
    event_id,
    parse_event_report_range(request),
  );
  return new Response(report.buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${report.filename}"; filename*=UTF-8''${encodeURIComponent(report.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function list_payments(
  request: NextRequest,
  auth: TenantAuth,
  event_id: string,
) {
  const query = pagination(request);
  const where: Prisma.PaymentWhereInput = {
    tenantId: auth.tenant_id,
    registration: { eventId: event_id },
    ...(query.status ? { status: query.status } : {}),
  };
  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      include: {
        registration: {
          select: { registrationCode: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.per_page,
      take: query.per_page,
    }),
    prisma.payment.count({ where }),
  ]);
  return api_ok(
    { payments },
    { page: query.page, per_page: query.per_page, total },
  );
}

function audit(
  auth: TenantAuth,
  action: string,
  entity_type: string,
  entity_id: string,
  before?: unknown,
  after?: unknown,
) {
  return prisma.auditLog.create({
    data: {
      tenantId: auth.tenant_id,
      actorUserId: auth.context.sub,
      actorRole: auth.context.role,
      action,
      entityType: entity_type,
      entityId: entity_id,
      beforeJson: before as Prisma.InputJsonValue,
      afterJson: after as Prisma.InputJsonValue,
    },
  });
}
