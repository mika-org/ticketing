import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function api_ok(
  data: unknown = {},
  meta?: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    {
      success: true,
      message: "Operation completed",
      data,
      ...(meta ? { meta } : {}),
    },
    { status },
  );
}

export function api_error(error: unknown) {
  const correlation_id = crypto.randomUUID();
  const error_like = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    code?: unknown;
    issues?: unknown;
    flatten?: () => unknown;
  };
  const api_failure =
    error instanceof ApiError ||
    (error !== null &&
      typeof error === "object" &&
      typeof error_like.status === "number" &&
      typeof error_like.code === "string" &&
      typeof error_like.message === "string");
  if (api_failure) {
    const failure = error as ApiError;
    return NextResponse.json(
      {
        success: false,
        message: failure.message,
        error: { code: failure.code, correlation_id, details: failure.details },
      },
      { status: failure.status },
    );
  }
  if (
    error instanceof ZodError ||
    (error_like?.name === "ZodError" && Array.isArray(error_like.issues))
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Data yang dikirim tidak valid",
        error: {
          code: "validation_error",
          correlation_id,
          details:
            typeof error_like.flatten === "function"
              ? error_like.flatten()
              : { issues: error_like.issues },
        },
      },
      { status: 422 },
    );
  }
  console.error(
    `[${correlation_id}]`,
    error instanceof Error ? error.message : error,
  );
  return NextResponse.json(
    {
      success: false,
      message: "Terjadi kesalahan internal",
      error: { code: "internal_error", correlation_id },
    },
    { status: 500 },
  );
}

export async function parse_body<T>(request: NextRequest, schema: ZodType<T>) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Body JSON tidak valid");
  }
  const parsed = await schema.safeParseAsync(body);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_error",
      "Data yang dikirim tidak valid",
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

export function pagination(request: NextRequest) {
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page") ?? 1),
  );
  const per_page = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("per_page") ?? 20)),
  );
  const search =
    request.nextUrl.searchParams.get("search")?.trim() || undefined;
  const status =
    request.nextUrl.searchParams.get("status")?.trim() || undefined;
  return { page, per_page, search, status };
}

export function assert_same_origin(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const allowed = (
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  if (origin && origin.replace(/\/$/, "") !== allowed) {
    throw new ApiError(403, "csrf_rejected", "Origin request tidak diizinkan");
  }
}

const rate_buckets = new Map<string, { count: number; reset_at: number }>();

export function rate_limit(
  request: NextRequest,
  scope: string,
  limit: number,
  window_ms: number,
) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const key = `${scope}:${forwarded ?? "local"}`;
  const now = Date.now();
  const bucket = rate_buckets.get(key);
  if (!bucket || bucket.reset_at <= now) {
    rate_buckets.set(key, { count: 1, reset_at: now + window_ms });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit)
    throw new ApiError(
      429,
      "rate_limited",
      "Terlalu banyak request, coba lagi nanti",
    );
}
