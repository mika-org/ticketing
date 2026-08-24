import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  auth_context,
  create_session,
  hash_password,
  select_tenant_context,
  set_auth_cookies,
  sign_access,
  verify_password,
  verify_refresh_token,
  type AuthContext,
} from '@/lib/server/auth';
import { ApiError, api_error, api_ok, assert_same_origin, parse_body, rate_limit } from '@/lib/server/api';
import { sha256 } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { login_schema, refresh_schema, tenant_context_schema } from '@/lib/validation';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ action: string }> };

export async function GET(request: NextRequest, route_context: RouteContext) {
  try {
    const { action } = await route_context.params;
    if (action !== 'me') throw new ApiError(404, 'not_found', 'Endpoint tidak ditemukan');
    const auth = await auth_context(request);
    return api_ok({
      user: {
        id: auth.user.id,
        full_name: auth.user.fullName,
        email: auth.user.email,
        whatsapp_number: auth.user.whatsappNumber,
        is_super_admin: auth.user.isSuperAdmin,
      },
      context: {
        tenant_id: auth.context.tenant_id,
        role: auth.context.role,
      },
    });
  } catch (error) {
    return api_error(error);
  }
}

export async function POST(request: NextRequest, route_context: RouteContext) {
  try {
    assert_same_origin(request);
    const { action } = await route_context.params;
    if (action === 'login') return login(request);
    if (action === 'refresh') return refresh(request);
    if (action === 'logout') return logout(request);
    if (action === 'tenant-context') return tenant_context(request);
    if (action === 'forgot-password') return forgot_password(request);
    if (action === 'reset-password') return reset_password(request);
    throw new ApiError(404, 'not_found', 'Endpoint tidak ditemukan');
  } catch (error) {
    return api_error(error);
  }
}

async function login(request: NextRequest) {
  rate_limit(request, 'login', 10, 60_000);
  const input = await parse_body(request, login_schema);
  const user = await prisma.user.findFirst({
    where: { email: { equals: input.email.trim(), mode: 'insensitive' }, deletedAt: null },
    include: {
      memberships: {
        where: { status: 'active', deletedAt: null, tenant: { status: 'active', deletedAt: null } },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
  if (!user || user.status !== 'active' || !(await verify_password(user.passwordHash, input.password))) {
    throw new ApiError(401, 'invalid_login', 'Email atau password salah');
  }
  const initial_membership = user.isSuperAdmin ? undefined : user.memberships[0];
  if (!user.isSuperAdmin && !initial_membership) throw new ApiError(403, 'tenant_inactive', 'Akun tidak memiliki tenant aktif');
  const context: AuthContext = {
    sub: user.id,
    email: user.email,
    is_super_admin: user.isSuperAdmin,
    tenant_id: initial_membership?.tenantId ?? null,
    role: user.isSuperAdmin ? 'super_admin' : (initial_membership?.role as AuthContext['role']),
  };
  const tokens = await create_session(user, context, request);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const response = api_ok({
    user: {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      is_super_admin: user.isSuperAdmin,
      tenant_id: context.tenant_id,
      role: context.role,
    },
    tenants: user.memberships.map((membership) => ({ ...membership.tenant, role: membership.role })),
    ...tokens,
  });
  set_auth_cookies(response, tokens.access_token, tokens.refresh_token);
  return response;
}

async function refresh(request: NextRequest) {
  const input = await parse_body(request, refresh_schema);
  const refresh_token = input.refresh_token ?? request.cookies.get('refresh_token')?.value;
  if (!refresh_token) throw new ApiError(401, 'invalid_refresh_token', 'Refresh token diperlukan');
  const payload = await verify_refresh_token(refresh_token);
  const session = await prisma.authSession.findFirst({
    where: { id: payload.session_id, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!session || session.refreshTokenHash !== sha256(refresh_token)) {
    throw new ApiError(401, 'invalid_refresh_token', 'Refresh token tidak valid atau sudah digunakan');
  }
  const selected = payload.tenant_id
    ? await select_tenant_context(session.user, payload.tenant_id)
    : {
        sub: session.user.id,
        email: session.user.email,
        is_super_admin: true,
        tenant_id: null,
        role: 'super_admin' as const,
      };
  const replacement = await create_session(session.user, selected, request);
  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date(), replacedById: replacement.session_id },
  });
  const response = api_ok(replacement);
  set_auth_cookies(response, replacement.access_token, replacement.refresh_token);
  return response;
}

async function logout(request: NextRequest) {
  const input = await parse_body(request, refresh_schema);
  const refresh_token = input.refresh_token ?? request.cookies.get('refresh_token')?.value;
  if (refresh_token) {
    try {
      const payload = await verify_refresh_token(refresh_token);
      await prisma.authSession.updateMany({
        where: { id: payload.session_id, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logout remains idempotent even when the token is already invalid.
    }
  }
  const response = api_ok({ logged_out: true });
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}

async function tenant_context(request: NextRequest) {
  const { user, context } = await auth_context(request);
  const input = await parse_body(request, tenant_context_schema);
  const selected = await select_tenant_context(user, input.tenant_id);
  const access_token = await sign_access(selected);
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenant_id,
      actorUserId: user.id,
      actorRole: context.role,
      action: 'auth.tenant_context_changed',
      entityType: 'tenant',
      entityId: input.tenant_id,
      afterJson: { tenant_id: input.tenant_id },
    },
  });
  const response = api_ok({ access_token, tenant_id: input.tenant_id, role: selected.role });
  set_auth_cookies(response, access_token);
  return response;
}

async function forgot_password(request: NextRequest) {
  rate_limit(request, 'forgot-password', 5, 60_000);
  const input = await parse_body(request, z.object({ email: z.email() }).strict());
  const user = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' }, status: 'active', deletedAt: null },
  });
  if (!user) return api_ok({ accepted: true });
  const token = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) },
  });
  return api_ok({ accepted: true, ...(process.env.NODE_ENV === 'development' ? { development_reset_token: token } : {}) });
}

async function reset_password(request: NextRequest) {
  const input = await parse_body(
    request,
    z.object({ token: z.string().min(32), password: z.string().min(12) }).strict(),
  );
  const reset = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: sha256(input.token), usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!reset) throw new ApiError(400, 'invalid_reset_token', 'Token reset tidak valid atau kedaluwarsa');
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hash_password(input.password) } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.authSession.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return api_ok({ reset: true });
}
