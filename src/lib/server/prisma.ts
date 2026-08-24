import { PrismaClient } from '@prisma/client';

const global_prisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  global_prisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') global_prisma.prisma = prisma;
