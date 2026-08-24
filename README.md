# Ticketing Multitenant

Aplikasi web dan backend REST API dalam satu Next.js App Router. PostgreSQL dikelola dengan Prisma pada schema `public`. Integrasi Ionic belum disertakan.

## Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Salin `.env.example` ke `.env` dan isi kredensial. Daftar endpoint tersedia di `/api` dan aplikasi di `http://localhost:3000`.

Seed Super Admin membaca `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, dan `SUPER_ADMIN_PASSWORD` dari `.env`. Seed bersifat idempotent: akun dengan email yang sama akan diperbarui dan diaktifkan sebagai Super Admin.

## Verifikasi

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma migrate status
```

Lihat [backend.md](./backend.md) dan [frontend.md](./frontend.md) untuk spesifikasi domain lengkap. Catatan deployment, backup, webhook Xendit, dan RLS ada di [docs/deployment.md](./docs/deployment.md).
