import type { PaymentConfig, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { require_tenant } from "@/lib/server/auth";
import {
  ApiError,
  api_error,
  api_ok,
  assert_same_origin,
  parse_body,
} from "@/lib/server/api";
import { decrypt_secret, encrypt_secret } from "@/lib/server/crypto";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ path?: string[] }> };

const admin_roles = ["super_admin", "tenant_admin"] as const;
const config_schema = z
  .object({
    environment: z.enum(["test", "live"]),
    business_id: z.string().trim().max(160).optional().or(z.literal("")),
    secret_api_key: z.string().trim().min(10).optional().or(z.literal("")),
    webhook_token: z.string().trim().min(8).optional().or(z.literal("")),
    api_version: z.string().trim().min(1).max(24).default("2024-11-11"),
    is_active: z.boolean().default(true),
  })
  .strict();

export async function GET(request: NextRequest, route_context: RouteContext) {
  try {
    const auth = await require_tenant(request, [...admin_roles]);
    const path = (await route_context.params).path ?? [];
    if (path.length)
      throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
    const config = await own_config(auth.tenant_id);
    return api_ok({
      payment_config: config ? safe_config(config) : null,
      webhook_path: "/api/v1/webhooks/xendit/payments",
    });
  } catch (error) {
    return api_error(error);
  }
}

export async function PUT(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const auth = await require_tenant(request, [...admin_roles]);
    const path = (await route_context.params).path ?? [];
    if (path.length)
      throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
    const input = await parse_body(request, config_schema);
    const current = await own_config(auth.tenant_id);
    if (!current && (!input.secret_api_key || !input.webhook_token)) {
      throw new ApiError(
        422,
        "payment_config_secrets_required",
        "API key dan webhook token wajib diisi untuk konfigurasi baru",
      );
    }
    const data = {
      tenantId: auth.tenant_id,
      provider: "xendit",
      accountMode: "tenant",
      environment: input.environment,
      businessId: input.business_id || null,
      secretApiKeyEncrypted: input.secret_api_key
        ? encrypt_secret(input.secret_api_key)
        : current!.secretApiKeyEncrypted,
      webhookTokenEncrypted: input.webhook_token
        ? encrypt_secret(input.webhook_token)
        : current!.webhookTokenEncrypted,
      apiVersion: input.api_version,
      isDefault: false,
      isActive: input.is_active,
      verifiedAt: input.secret_api_key ? null : current?.verifiedAt,
    };
    const config = current
      ? await prisma.paymentConfig.update({ where: { id: current.id }, data })
      : await prisma.paymentConfig.create({ data });
    await audit(
      auth.tenant_id,
      auth.context.sub,
      auth.context.role,
      config.id,
      current ? "payment_config.updated" : "payment_config.created",
    );
    return api_ok({ payment_config: safe_config(config) });
  } catch (error) {
    return api_error(error);
  }
}

export async function POST(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const auth = await require_tenant(request, [...admin_roles]);
    const path = (await route_context.params).path ?? [];
    if (path.length !== 1 || path[0] !== "test")
      throw new ApiError(404, "not_found", "Endpoint tidak ditemukan");
    const config = await own_config(auth.tenant_id);
    if (!config || !config.isActive)
      throw new ApiError(
        404,
        "payment_config_missing",
        "Konfigurasi Xendit tenant belum aktif",
      );
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
    const verified = await prisma.paymentConfig.update({
      where: { id: config.id },
      data: { verifiedAt: new Date() },
    });
    await audit(
      auth.tenant_id,
      auth.context.sub,
      auth.context.role,
      config.id,
      "payment_config.verified",
    );
    return api_ok({ verified: true, payment_config: safe_config(verified) });
  } catch (error) {
    return api_error(error);
  }
}

function own_config(tenant_id: string) {
  return prisma.paymentConfig.findFirst({
    where: { tenantId: tenant_id, provider: "xendit", deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

function safe_config(config: PaymentConfig) {
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
  actor_role: string | null,
  entity_id: string,
  action: string,
) {
  return prisma.auditLog.create({
    data: {
      tenantId: tenant_id,
      actorUserId: actor_id,
      actorRole: actor_role,
      action,
      entityType: "payment_config",
      entityId: entity_id,
      afterJson: {
        provider: "xendit",
        scope: "tenant",
      } as Prisma.InputJsonValue,
    },
  });
}
