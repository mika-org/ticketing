import { Prisma } from "@prisma/client";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError } from "./api";
import { decrypt_secret, encrypt_secret } from "./crypto";
import { prisma } from "./prisma";
import { issue_tickets, public_tickets } from "./tickets";

export async function effective_payment_config(tenant_id: string) {
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

export async function cancel_active_xendit_payment_requests(
  tenant_id: string,
  registration_id: string,
) {
  const payments = await prisma.payment.findMany({
    where: {
      tenantId: tenant_id,
      registrationId: registration_id,
      provider: "xendit",
      status: { in: ["pending", "requires_action"] },
      providerPaymentRequestId: { not: null },
    },
    select: { providerPaymentRequestId: true },
  });
  if (!payments.length) return;

  const config = await effective_payment_config(tenant_id);
  const base_url = process.env.XENDIT_API_BASE_URL ?? "https://api.xendit.co";
  const headers = {
    Authorization: `Basic ${Buffer.from(`${decrypt_secret(config.secretApiKeyEncrypted)}:`).toString("base64")}`,
    "api-version": config.apiVersion,
    "Content-Type": "application/json",
  };

  for (const payment of payments) {
    const request_id = payment.providerPaymentRequestId;
    if (!request_id) continue;
    const endpoint = `${base_url}/v3/payment_requests/${encodeURIComponent(request_id)}`;
    let response: Response;
    try {
      response = await fetch(`${endpoint}/cancel`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError(
        502,
        "xendit_cancellation_unavailable",
        "Xendit tidak dapat dihubungi; settlement OTS belum dijalankan",
      );
    }
    if (response.ok) continue;

    // A retry can reach an already-cancelled request. Confirm its latest state
    // before deciding whether manual settlement remains safe.
    let status_response: Response;
    try {
      status_response = await fetch(endpoint, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError(
        502,
        "xendit_cancellation_unavailable",
        "Status QRIS Xendit tidak dapat diverifikasi; settlement OTS belum dijalankan",
      );
    }
    const status_payload = (await status_response
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const status = String(status_payload.status ?? "").toUpperCase();
    if (
      status_response.ok &&
      ["CANCELED", "CANCELLED", "EXPIRED"].includes(status)
    )
      continue;
    throw new ApiError(
      409,
      status === "SUCCEEDED"
        ? "registration_already_paid"
        : "xendit_cancellation_failed",
      status === "SUCCEEDED"
        ? "Pembayaran Xendit sudah berhasil; settlement OTS dibatalkan"
        : "QRIS Xendit aktif tidak dapat dibatalkan; settlement OTS belum dijalankan",
    );
  }
}

export async function create_qris(registration_code: string) {
  const registration = await prisma.registration.findUnique({
    where: { registrationCode: registration_code },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      event: { select: { name: true } },
    },
  });
  if (!registration)
    throw new ApiError(
      404,
      "registration_not_found",
      "Pendaftaran tidak ditemukan",
    );
  if (registration.totalAmount.isZero())
    throw new ApiError(
      422,
      "payment_not_required",
      "Pendaftaran gratis tidak memerlukan pembayaran",
    );
  if (registration.status === "confirmed")
    return payment_status(registration_code);
  let payment = registration.payments.find(
    (entry) => entry.status === "pending",
  );
  if (!payment)
    throw new ApiError(
      409,
      "payment_not_available",
      "Tidak ada pembayaran aktif; gunakan coba ulang",
    );
  if (payment.providerPaymentRequestId && payment.qrStringEncrypted)
    return serialize_payment(payment);

  const config = await effective_payment_config(registration.tenantId);
  const response = await fetch(
    `${process.env.XENDIT_API_BASE_URL ?? "https://api.xendit.co"}/v3/payment_requests`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${decrypt_secret(config.secretApiKeyEncrypted)}:`).toString("base64")}`,
        "api-version": config.apiVersion,
        "Content-Type": "application/json",
        "Idempotency-Key": payment.referenceId,
      },
      body: JSON.stringify({
        reference_id: payment.referenceId,
        type: "PAY",
        country: "ID",
        currency: registration.currency,
        request_amount: Number(registration.totalAmount),
        capture_method: "AUTOMATIC",
        channel_code: "QRIS",
        description:
          `${registration.event.name} - ${registration.registrationCode}`.slice(
            0,
            255,
          ),
        metadata: {
          registration_code: registration.registrationCode,
          tenant_reference: createHash("sha256")
            .update(registration.tenantId)
            .digest("hex")
            .slice(0, 24),
          event_reference: createHash("sha256")
            .update(registration.eventId)
            .digest("hex")
            .slice(0, 24),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    any
  >;
  if (!response.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        failureCode: String(payload.error_code ?? `http_${response.status}`),
      },
    });
    throw new ApiError(409, "payment_creation_failed", "Pembuatan QRIS gagal");
  }
  const qr_action = (
    payload.actions as Record<string, unknown>[] | undefined
  )?.find((action) => {
    const action_name = String(
      action.action ?? action.type ?? "",
    ).toUpperCase();
    const descriptor = String(
      action.descriptor ?? action.method ?? "",
    ).toUpperCase();
    return (
      action_name === "PRESENT_TO_CUSTOMER" &&
      ["QR_STRING", "QR_CODE"].includes(descriptor)
    );
  });
  const qr_string = qr_action?.value ?? qr_action?.url ?? qr_action?.qr_string;
  if (typeof qr_string !== "string")
    throw new ApiError(
      409,
      "payment_creation_failed",
      "Respons Xendit tidak memiliki QR string",
    );
  payment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentRequestId: String(
        payload.payment_request_id ?? payload.id,
      ),
      providerBusinessId: payload.business_id
        ? String(payload.business_id)
        : config.businessId,
      status: provider_status(String(payload.status ?? "PENDING")),
      qrStringEncrypted: encrypt_secret(qr_string),
      qrExpiresAt: payload.expires_at
        ? new Date(payload.expires_at)
        : undefined,
      providerCreatedAt: payload.created
        ? new Date(payload.created)
        : payload.created_at
          ? new Date(payload.created_at)
          : undefined,
    },
  });
  return serialize_payment(payment);
}

export async function payment_status(registration_code: string) {
  const registration = await prisma.registration.findUnique({
    where: { registrationCode: registration_code },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      tickets: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!registration)
    throw new ApiError(
      404,
      "registration_not_found",
      "Pendaftaran tidak ditemukan",
    );
  const payment = registration.payments[0];
  return {
    registration_code: registration.registrationCode,
    registration_status: registration.status,
    payment: payment ? serialize_payment(payment) : null,
    tickets:
      registration.status === "confirmed"
        ? public_tickets(registration.tickets)
        : [],
  };
}

export async function retry_payment(registration_code: string) {
  const registration = await prisma.registration.findUnique({
    where: { registrationCode: registration_code },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!registration)
    throw new ApiError(
      404,
      "registration_not_found",
      "Pendaftaran tidak ditemukan",
    );
  if (registration.status === "confirmed")
    throw new ApiError(
      409,
      "registration_confirmed",
      "Pendaftaran sudah dikonfirmasi",
    );
  if (
    registration.payments.some((payment) =>
      ["pending", "requires_action"].includes(payment.status),
    )
  ) {
    throw new ApiError(
      409,
      "payment_still_active",
      "Masih ada pembayaran aktif",
    );
  }
  const sequence = registration.payments.length + 1;
  await prisma.$transaction([
    prisma.payment.create({
      data: {
        tenantId: registration.tenantId,
        registrationId: registration.id,
        referenceId: `PAY-${registration.id}-${sequence}`,
        amount: registration.totalAmount,
        currency: registration.currency,
        status: "pending",
      },
    }),
    prisma.registration.update({
      where: { id: registration.id },
      data: { status: "pending_payment" },
    }),
  ]);
  return create_qris(registration_code);
}

export async function process_xendit_webhook(
  request: NextRequest,
  body: Record<string, any>,
) {
  const data = (body.data ?? body) as Record<string, any>;
  const reference_id = primitive_string(data.reference_id ?? body.reference_id);
  const request_id = primitive_string(
    data.payment_request_id ?? body.payment_request_id,
  );
  const provider_payment_id = primitive_string(
    data.payment_id ?? data.id ?? body.payment_id,
  );
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        ...(reference_id ? [{ referenceId: reference_id }] : []),
        ...(request_id ? [{ providerPaymentRequestId: request_id }] : []),
        ...(provider_payment_id
          ? [{ providerPaymentId: provider_payment_id }]
          : []),
      ],
    },
  });
  const callback_token = request.headers.get("x-callback-token");
  if (
    !callback_token ||
    !(await valid_callback_token(callback_token, payment?.tenantId))
  ) {
    throw new ApiError(
      403,
      "invalid_xendit_webhook",
      "Webhook Xendit tidak valid",
    );
  }
  const event_name = String(
    body.event ?? body.event_type ?? body.type ?? "payment.unknown",
  );
  const event_key = createHash("sha256")
    .update(
      [
        event_name,
        provider_payment_id,
        request_id,
        reference_id,
        data.status,
        data.created ?? data.created_at,
      ].join("|"),
    )
    .digest("hex");
  let webhook_event;
  try {
    webhook_event = await prisma.paymentWebhookEvent.create({
      data: {
        tenantId: payment?.tenantId,
        eventName: event_name,
        providerEventKey: event_key,
        providerPaymentId: provider_payment_id,
        providerPaymentRequestId: request_id,
        referenceId: reference_id,
        payloadJson: sanitize(body) as Prisma.InputJsonValue,
        headersJsonMasked: mask_headers(request) as Prisma.InputJsonValue,
        status: "received",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { accepted: true, duplicate: true };
    throw error;
  }
  if (!payment) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhook_event.id },
      data: {
        status: "orphan",
        processingError: "Payment internal tidak ditemukan",
        processedAt: new Date(),
      },
    });
    return { accepted: true, orphan: true };
  }
  await process_payment_state(payment.id, event_name, data, webhook_event.id);
  return { accepted: true };
}

async function process_payment_state(
  payment_id: string,
  event_name: string,
  data: Record<string, any>,
  webhook_event_id: string,
) {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment_id}))`;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: payment_id },
      });
      const amount = new Prisma.Decimal(
        data.capture_amount ??
          data.request_amount ??
          data.amount ??
          payment.amount,
      );
      const currency = String(data.currency ?? payment.currency);
      const business_id = primitive_string(data.business_id);
      if (
        !amount.equals(payment.amount) ||
        currency !== payment.currency ||
        (payment.providerBusinessId &&
          business_id &&
          payment.providerBusinessId !== business_id)
      ) {
        throw new ApiError(
          409,
          "payment_amount_mismatch",
          "Data pembayaran provider tidak cocok",
        );
      }
      const status = String(data.status ?? event_name).toUpperCase();
      const succeeded =
        event_name === "payment.capture" ||
        ["SUCCEEDED", "COMPLETED", "CAPTURED", "PAID"].includes(status);
      const failed =
        event_name === "payment.failure" ||
        ["FAILED", "CANCELED", "CANCELLED"].includes(status);
      const expired =
        event_name.includes("expiry") ||
        event_name.includes("expired") ||
        status === "EXPIRED";
      if (payment.failureCode === "replaced_by_manual_ots") {
        if (succeeded) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "succeeded",
              failureCode: "manual_settlement_conflict",
              providerPaymentId:
                primitive_string(data.payment_id ?? data.id) ??
                payment.providerPaymentId,
              providerBusinessId: business_id ?? payment.providerBusinessId,
              paidAt: data.created ? new Date(data.created) : new Date(),
              lastCheckedAt: new Date(),
              qrStringEncrypted: null,
            },
          });
          await tx.auditLog.create({
            data: {
              tenantId: payment.tenantId,
              actorRole: "xendit_webhook",
              action: "payment.manual_settlement_conflict",
              entityType: "payment",
              entityId: payment.id,
              beforeJson: {
                status: payment.status,
                failure_code: payment.failureCode,
              },
              afterJson: {
                status: "succeeded",
                failure_code: "manual_settlement_conflict",
              },
            },
          });
          await tx.paymentWebhookEvent.update({
            where: { id: webhook_event_id },
            data: {
              status: "manual_settlement_conflict",
              processedAt: new Date(),
            },
          });
        } else {
          await tx.paymentWebhookEvent.update({
            where: { id: webhook_event_id },
            data: {
              status: "ignored_after_manual_ots",
              processedAt: new Date(),
            },
          });
        }
        return;
      }
      if (succeeded && payment.status !== "succeeded") {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "succeeded",
            providerPaymentId:
              primitive_string(data.payment_id ?? data.id) ??
              payment.providerPaymentId,
            providerBusinessId: business_id ?? payment.providerBusinessId,
            paidAt: data.created ? new Date(data.created) : new Date(),
            lastCheckedAt: new Date(),
            qrStringEncrypted: null,
          },
        });
        await tx.registration.update({
          where: { id: payment.registrationId },
          data: { status: "confirmed" },
        });
        await issue_tickets(tx, payment.registrationId);
      } else if (payment.status !== "succeeded" && (failed || expired)) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: expired ? "expired" : "failed",
            failureCode: primitive_string(
              data.failure_code ?? data.failure_reason,
            ),
            expiredAt: expired ? new Date() : undefined,
            lastCheckedAt: new Date(),
            qrStringEncrypted: null,
          },
        });
        await tx.registration.update({
          where: { id: payment.registrationId },
          data: { status: expired ? "expired" : "pending_payment" },
        });
      }
      await tx.paymentWebhookEvent.update({
        where: { id: webhook_event_id },
        data: { status: "processed", processedAt: new Date() },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function valid_callback_token(token: string, tenant_id?: string) {
  const configs = await prisma.paymentConfig.findMany({
    where: {
      provider: "xendit",
      isActive: true,
      deletedAt: null,
      ...(tenant_id
        ? { OR: [{ tenantId: tenant_id }, { tenantId: null, isDefault: true }] }
        : {}),
    },
  });
  return configs.some((config) => {
    const expected = Buffer.from(decrypt_secret(config.webhookTokenEncrypted));
    const actual = Buffer.from(token);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  });
}

function serialize_payment(payment: {
  id: string;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  qrStringEncrypted: string | null;
  qrExpiresAt: Date | null;
  referenceId: string;
}) {
  return {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    qr_string: payment.qrStringEncrypted
      ? decrypt_secret(payment.qrStringEncrypted)
      : null,
    qr_expires_at: payment.qrExpiresAt,
    reference_id: payment.referenceId,
  };
}

function provider_status(value: string) {
  const status = value.toUpperCase();
  if (["REQUIRES_ACTION", "ACTION_REQUIRED"].includes(status))
    return "requires_action";
  if (["SUCCEEDED", "COMPLETED", "PAID"].includes(status)) return "succeeded";
  if (status === "FAILED") return "failed";
  if (status === "EXPIRED") return "expired";
  return "pending";
}

function primitive_string(value: unknown) {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : undefined;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      [
        "qr_string",
        "authorization",
        "secret_api_key",
        "x-callback-token",
      ].includes(key.toLowerCase())
        ? "[MASKED]"
        : sanitize(entry),
    ]),
  );
}

function mask_headers(request: NextRequest) {
  return Object.fromEntries(
    [...request.headers.entries()].map(([key, value]) => [
      key,
      ["authorization", "x-callback-token", "cookie"].includes(
        key.toLowerCase(),
      )
        ? "[MASKED]"
        : value,
    ]),
  );
}
