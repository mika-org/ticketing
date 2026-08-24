import { Prisma, type PaymentConfig } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { hash_password, require_roles } from "@/lib/server/auth";
import {
  ApiError,
  api_error,
  api_ok,
  assert_same_origin,
  pagination,
  parse_body,
} from "@/lib/server/api";
import { decrypt_secret, encrypt_secret } from "@/lib/server/crypto";
import { prisma } from "@/lib/server/prisma";
import {
  tenant_schema,
  tenant_update_schema,
  tenant_user_schema,
  uuid_schema,
} from "@/lib/validation";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ path?: string[] }> };

const payment_config_schema = z
  .object({
    account_mode: z.enum(["platform", "tenant"]),
    environment: z.enum(["test", "live"]),
    business_id: z.string().max(160).optional(),
    secret_api_key: z.string().min(10).optional().or(z.literal("")),
    webhook_token: z.string().min(8).optional().or(z.literal("")),
    api_version: z.string().default("2024-11-11"),
    is_active: z.boolean().default(true),
  })
  .strict();

export async function GET(request: NextRequest, route_context: RouteContext) {
  try {
    await require_roles(request, ["super_admin"]);
    const path = (await route_context.params).path ?? [];
    if (path.length === 0) return list_tenants(request);
    const tenant_id = uuid_schema.parse(path[0]);
    if (path.length === 1) return get_tenant(tenant_id);
    if (path[1] === "users" && path.length === 2)
      return list_users(request, tenant_id);
    if (path[1] === "payment-config" && path.length === 2)
      return get_payment_config(tenant_id);
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

export async function POST(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const auth = await require_roles(request, ["super_admin"]);
    const path = (await route_context.params).path ?? [];
    if (path.length === 0) return create_tenant(request, auth.context.sub);
    const tenant_id = uuid_schema.parse(path[0]);
    if (path[1] === "users" && path.length === 2)
      return create_user(request, tenant_id, auth.context.sub);
    if (
      path[1] === "users" &&
      path[3] === "reset-password" &&
      path.length === 4
    ) {
      return reset_user_password(
        tenant_id,
        uuid_schema.parse(path[2]),
        auth.context.sub,
      );
    }
    if (path[1] === "payment-config" && path[2] === "test")
      return test_payment_config(tenant_id);
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

export async function PATCH(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const auth = await require_roles(request, ["super_admin"]);
    const path = (await route_context.params).path ?? [];
    const tenant_id = uuid_schema.parse(path[0]);
    if (path.length === 1)
      return update_tenant(request, tenant_id, auth.context.sub);
    if (path[1] === "users" && path.length === 3) {
      return update_user(
        request,
        tenant_id,
        uuid_schema.parse(path[2]),
        auth.context.sub,
      );
    }
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

export async function PUT(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const auth = await require_roles(request, ["super_admin"]);
    const path = (await route_context.params).path ?? [];
    const tenant_id = uuid_schema.parse(path[0]);
    if (path[1] === "payment-config" && path.length === 2) {
      return save_payment_config(request, tenant_id, auth.context.sub);
    }
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
  } catch (error) {
    return api_error(error);
  }
}

async function list_tenants(request: NextRequest) {
  const query = pagination(request);
  const where: Prisma.TenantWhereInput = {
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { slug: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [tenants, total] = await prisma.$transaction([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.per_page,
      take: query.per_page,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        email: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true, events: true, registrations: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);
  return api_ok(
    { tenants },
    { page: query.page, per_page: query.per_page, total },
  );
}

async function get_tenant(tenant_id: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenant_id, deletedAt: null },
    include: {
      _count: {
        select: {
          users: true,
          events: true,
          registrations: true,
          tickets: true,
        },
      },
    },
  });
  if (!tenant)
    throw new ApiError(404, "tenant_not_found", "Tenant tidak ditemukan");
  return api_ok({ tenant });
}

async function create_tenant(request: NextRequest, actor_id: string) {
  const input = await parse_body(request, tenant_schema);
  const duplicate = await prisma.tenant.findFirst({
    where: { slug: input.slug, deletedAt: null },
  });
  if (duplicate)
    throw new ApiError(
      409,
      "duplicate_tenant_slug",
      "Slug tenant sudah digunakan",
    );
  const user_duplicate = await prisma.user.findFirst({
    where: {
      email: { equals: input.admin_email, mode: "insensitive" },
      deletedAt: null,
    },
  });
  if (user_duplicate)
    throw new ApiError(
      409,
      "duplicate_user_email",
      "Email Admin Tenant sudah digunakan",
    );
  const password_hash = await hash_password(input.admin_password);
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        email: input.email?.toLowerCase(),
        whatsappNumber: input.whatsapp_number,
        address: input.address,
        primaryColor: input.primary_color,
        customDomain: input.custom_domain,
      },
    });
    const admin = await tx.user.create({
      data: {
        fullName: input.admin_full_name,
        email: input.admin_email.toLowerCase(),
        passwordHash: password_hash,
        status: "active",
      },
    });
    await tx.tenantUser.create({
      data: {
        tenantId: tenant.id,
        userId: admin.id,
        role: "tenant_admin",
        status: "active",
        createdBy: actor_id,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: actor_id,
        actorRole: "super_admin",
        action: "tenant.created",
        entityType: "tenant",
        entityId: tenant.id,
        afterJson: { name: tenant.name, slug: tenant.slug },
      },
    });
    return {
      tenant,
      admin: { id: admin.id, full_name: admin.fullName, email: admin.email },
    };
  });
  return api_ok(result, undefined, 201);
}

async function update_tenant(
  request: NextRequest,
  tenant_id: string,
  actor_id: string,
) {
  const input = await parse_body(request, tenant_update_schema);
  const before = await prisma.tenant.findFirst({
    where: { id: tenant_id, deletedAt: null },
  });
  if (!before)
    throw new ApiError(404, "tenant_not_found", "Tenant tidak ditemukan");
  const tenant = await prisma.tenant.update({
    where: { id: tenant_id },
    data: {
      name: input.name,
      email: input.email?.toLowerCase(),
      whatsappNumber: input.whatsapp_number,
      address: input.address,
      primaryColor: input.primary_color,
      customDomain: input.custom_domain,
      status: input.status,
    },
  });
  await audit(
    tenant_id,
    actor_id,
    "tenant.updated",
    "tenant",
    tenant_id,
    before,
    tenant,
  );
  return api_ok({ tenant });
}

async function list_users(request: NextRequest, tenant_id: string) {
  const query = pagination(request);
  await get_tenant(tenant_id);
  const where: Prisma.TenantUserWhereInput = {
    tenantId: tenant_id,
    deletedAt: null,
    ...(query.search
      ? {
          user: {
            OR: [
              {
                fullName: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                email: { contains: query.search, mode: "insensitive" as const },
              },
            ],
          },
        }
      : {}),
  };
  const [users, total] = await prisma.$transaction([
    prisma.tenantUser.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            whatsappNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.per_page,
      take: query.per_page,
    }),
    prisma.tenantUser.count({ where }),
  ]);
  return api_ok(
    { users },
    { page: query.page, per_page: query.per_page, total },
  );
}

async function create_user(
  request: NextRequest,
  tenant_id: string,
  actor_id: string,
) {
  const input = await parse_body(request, tenant_user_schema);
  await get_tenant(tenant_id);
  let user = await prisma.user.findFirst({
    where: {
      email: { equals: input.email, mode: "insensitive" },
      deletedAt: null,
    },
  });
  if (user) {
    const membership = await prisma.tenantUser.findFirst({
      where: { tenantId: tenant_id, userId: user.id, deletedAt: null },
    });
    if (membership)
      throw new ApiError(
        409,
        "duplicate_tenant_user",
        "Pengguna sudah terdaftar pada tenant ini",
      );
  }
  const password_hash = await hash_password(input.password);
  const result = await prisma.$transaction(async (tx) => {
    user ??= await tx.user.create({
      data: {
        fullName: input.full_name,
        email: input.email.toLowerCase(),
        whatsappNumber: input.whatsapp_number,
        passwordHash: password_hash,
        status: "active",
      },
    });
    const membership = await tx.tenantUser.create({
      data: {
        tenantId: tenant_id,
        userId: user.id,
        role: input.role,
        status: "active",
        createdBy: actor_id,
      },
    });
    return {
      membership,
      user: { id: user.id, full_name: user.fullName, email: user.email },
    };
  });
  await audit(
    tenant_id,
    actor_id,
    "tenant_user.created",
    "tenant_user",
    result.membership.id,
  );
  return api_ok({ tenant_user: result }, undefined, 201);
}

async function update_user(
  request: NextRequest,
  tenant_id: string,
  membership_id: string,
  actor_id: string,
) {
  const input = await parse_body(
    request,
    z
      .object({
        role: z.enum(["tenant_admin", "event_staff"]).optional(),
        status: z.enum(["active", "inactive", "invited", "locked"]).optional(),
      })
      .strict(),
  );
  const before = await prisma.tenantUser.findFirst({
    where: { id: membership_id, tenantId: tenant_id, deletedAt: null },
  });
  if (!before)
    throw new ApiError(
      404,
      "tenant_user_not_found",
      "Pengguna tenant tidak ditemukan",
    );
  const membership = await prisma.tenantUser.update({
    where: { id: membership_id },
    data: input,
  });
  await audit(
    tenant_id,
    actor_id,
    "tenant_user.updated",
    "tenant_user",
    membership_id,
    before,
    membership,
  );
  return api_ok({ tenant_user: membership });
}

async function reset_user_password(
  tenant_id: string,
  membership_id: string,
  actor_id: string,
) {
  const membership = await prisma.tenantUser.findFirst({
    where: { id: membership_id, tenantId: tenant_id, deletedAt: null },
  });
  if (!membership)
    throw new ApiError(
      404,
      "tenant_user_not_found",
      "Pengguna tenant tidak ditemukan",
    );
  const temporary_password = `${randomBytes(9).toString("base64url")}aA1!`;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash: await hash_password(temporary_password) },
    }),
    prisma.authSession.updateMany({
      where: { userId: membership.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await audit(
    tenant_id,
    actor_id,
    "tenant_user.password_reset",
    "tenant_user",
    membership_id,
  );
  return api_ok({ temporary_password });
}

async function get_payment_config(tenant_id: string) {
  await get_tenant(tenant_id);
  const config = await prisma.paymentConfig.findFirst({
    where: { tenantId: tenant_id, provider: "xendit", deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return api_ok({
    payment_config: config ? safe_payment_config(config) : null,
  });
}

async function save_payment_config(
  request: NextRequest,
  tenant_id: string,
  actor_id: string,
) {
  const input = await parse_body(request, payment_config_schema);
  await get_tenant(tenant_id);
  const current = await prisma.paymentConfig.findFirst({
    where: { tenantId: tenant_id, provider: "xendit", deletedAt: null },
  });
  if (!current && (!input.secret_api_key || !input.webhook_token)) {
    throw new ApiError(
      422,
      "payment_config_secrets_required",
      "API key dan webhook token wajib diisi untuk konfigurasi baru",
    );
  }
  const data = {
    tenantId: tenant_id,
    provider: "xendit",
    accountMode: input.account_mode,
    environment: input.environment,
    businessId: input.business_id,
    secretApiKeyEncrypted: input.secret_api_key
      ? encrypt_secret(input.secret_api_key)
      : current!.secretApiKeyEncrypted,
    webhookTokenEncrypted: input.webhook_token
      ? encrypt_secret(input.webhook_token)
      : current!.webhookTokenEncrypted,
    apiVersion: input.api_version,
    isActive: input.is_active,
  };
  const config = current
    ? await prisma.paymentConfig.update({ where: { id: current.id }, data })
    : await prisma.paymentConfig.create({ data });
  await audit(
    tenant_id,
    actor_id,
    "payment_config.rotated",
    "payment_config",
    config.id,
  );
  return api_ok({ payment_config: safe_payment_config(config) });
}

async function test_payment_config(tenant_id: string) {
  const config = await effective_payment_config(tenant_id);
  const response = await fetch(
    `${process.env.XENDIT_API_BASE_URL ?? "https://api.xendit.co"}/balance`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${decrypt_secret(config.secretApiKeyEncrypted)}:`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new ApiError(
      409,
      "payment_config_invalid",
      "Kredensial Xendit tidak dapat diverifikasi",
    );
  await prisma.paymentConfig.update({
    where: { id: config.id },
    data: { verifiedAt: new Date() },
  });
  return api_ok({ verified: true, environment: config.environment });
}

async function effective_payment_config(tenant_id: string) {
  const config =
    (await prisma.paymentConfig.findFirst({
      where: {
        tenantId: tenant_id,
        provider: "xendit",
        isActive: true,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    })) ??
    (await prisma.paymentConfig.findFirst({
      where: {
        tenantId: null,
        provider: "xendit",
        isDefault: true,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    }));
  if (!config)
    throw new ApiError(
      404,
      "payment_config_missing",
      "Konfigurasi Xendit aktif tidak ditemukan",
    );
  return config;
}

function safe_payment_config(config: PaymentConfig) {
  const { secretApiKeyEncrypted, webhookTokenEncrypted, ...safe } = config;
  return {
    ...safe,
    secret_configured: !!secretApiKeyEncrypted,
    webhook_configured: !!webhookTokenEncrypted,
  };
}

function audit(
  tenant_id: string,
  actor_id: string,
  action: string,
  entity_type: string,
  entity_id: string,
  before?: unknown,
  after?: unknown,
) {
  return prisma.auditLog.create({
    data: {
      tenantId: tenant_id,
      actorUserId: actor_id,
      actorRole: "super_admin",
      action,
      entityType: entity_type,
      entityId: entity_id,
      beforeJson: before as Prisma.InputJsonValue,
      afterJson: after as Prisma.InputJsonValue,
    },
  });
}
