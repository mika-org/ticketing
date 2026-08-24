import { api_error, api_ok } from '@/lib/server/api';
import { prisma } from '@/lib/server/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return api_ok({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    return api_error(error);
  }
}
