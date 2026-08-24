import type { User } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./api";
import { sha256 } from "./crypto";
import { prisma } from "./prisma";

export { hash_password, verify_password } from "./password";

export type AuthContext = {
  sub: string;
  email: string;
  is_super_admin: boolean;
  tenant_id: string | null;
  role: "super_admin" | "tenant_admin" | "event_staff" | null;
};

const access_secret = () =>
  new TextEncoder().encode(
    process.env.JWT_ACCESS_SECRET ??
      "unsafe-development-access-secret-change-me",
  );
const refresh_secret = () =>
  new TextEncoder().encode(
    process.env.JWT_REFRESH_SECRET ??
      "unsafe-development-refresh-secret-change-me",
  );

export async function sign_access(context: AuthContext) {
  const minutes = Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15);
  return new SignJWT(context)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(access_secret());
}

async function sign_refresh(context: AuthContext, session_id: string) {
  const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
  return new SignJWT({ ...context, session_id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(refresh_secret());
}

export async function create_session(
  user: User,
  context: AuthContext,
  request: NextRequest,
) {
  const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: "pending",
      expiresAt: new Date(Date.now() + days * 86_400_000),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent")?.slice(0, 500),
    },
  });
  const refresh_token = await sign_refresh(context, session.id);
  await prisma.authSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: sha256(refresh_token) },
  });
  return {
    access_token: await sign_access(context),
    refresh_token,
    session_id: session.id,
  };
}

export function set_auth_cookies(
  response: NextResponse,
  access_token: string,
  refresh_token?: string,
) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("access_token", access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15) * 60,
  });
  if (refresh_token) {
    response.cookies.set("refresh_token", refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86_400,
    });
  }
}

export async function auth_context(request: NextRequest) {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer ?? request.cookies.get("access_token")?.value;
  if (!token)
    throw new ApiError(401, "unauthorized", "Silakan login terlebih dahulu");
  let context: AuthContext;
  try {
    const verified = await jwtVerify(token, access_secret());
    context = verified.payload as AuthContext;
  } catch {
    throw new ApiError(401, "session_expired", "Sesi sudah berakhir");
  }
  const user = await prisma.user.findFirst({
    where: { id: context.sub, status: "active", deletedAt: null },
  });
  if (!user) throw new ApiError(401, "account_inactive", "Akun tidak aktif");
  if (context.tenant_id && !context.is_super_admin) {
    const membership = await prisma.tenantUser.findFirst({
      where: {
        tenantId: context.tenant_id,
        userId: context.sub,
        role: context.role ?? undefined,
        status: "active",
        deletedAt: null,
        tenant: { status: "active", deletedAt: null },
      },
    });
    if (!membership)
      throw new ApiError(
        403,
        "tenant_scope_violation",
        "Akses tenant tidak aktif",
      );
  }
  return { context, user };
}

export async function require_roles(
  request: NextRequest,
  roles: NonNullable<AuthContext["role"]>[],
) {
  const auth = await auth_context(request);
  if (!auth.context.role || !roles.includes(auth.context.role)) {
    throw new ApiError(403, "forbidden", "Izin tidak mencukupi");
  }
  return auth;
}

export async function require_tenant(
  request: NextRequest,
  roles: NonNullable<AuthContext["role"]>[] = [
    "super_admin",
    "tenant_admin",
    "event_staff",
  ],
) {
  const auth = await require_roles(request, roles);
  if (!auth.context.tenant_id)
    throw new ApiError(
      409,
      "tenant_context_required",
      "Pilih tenant aktif terlebih dahulu",
    );
  return { ...auth, tenant_id: auth.context.tenant_id };
}

export async function select_tenant_context(
  user: User,
  tenant_id: string,
): Promise<AuthContext> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenant_id, status: "active", deletedAt: null },
  });
  if (!tenant)
    throw new ApiError(
      404,
      "tenant_inactive",
      "Tenant tidak aktif atau tidak ditemukan",
    );
  if (user.isSuperAdmin) {
    return {
      sub: user.id,
      email: user.email,
      is_super_admin: true,
      tenant_id,
      role: "super_admin",
    };
  }
  const membership = await prisma.tenantUser.findFirst({
    where: {
      tenantId: tenant_id,
      userId: user.id,
      status: "active",
      deletedAt: null,
    },
  });
  if (!membership)
    throw new ApiError(
      403,
      "tenant_scope_violation",
      "Akses tenant tidak ditemukan",
    );
  return {
    sub: user.id,
    email: user.email,
    is_super_admin: false,
    tenant_id,
    role: membership.role as AuthContext["role"],
  };
}

export async function verify_refresh_token(refresh_token: string) {
  try {
    const verified = await jwtVerify(refresh_token, refresh_secret());
    return verified.payload as AuthContext & { session_id: string };
  } catch {
    throw new ApiError(
      401,
      "invalid_refresh_token",
      "Refresh token tidak valid",
    );
  }
}
