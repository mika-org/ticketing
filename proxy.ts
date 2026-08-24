import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const protected_route =
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/super-admin');
  if (protected_route && !request.cookies.has('access_token')) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/super-admin/:path*'] };
