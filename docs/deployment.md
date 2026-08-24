# Deployment dan Operasional

## Runtime

Aplikasi web dan REST API berjalan sebagai satu deployment Next.js Node runtime. Gunakan HTTPS, reverse proxy, CORS/origin yang benar, secret manager, dan PostgreSQL connection pooler. Jalankan `npm run prisma:migrate` sebelum mengalihkan traffic ke release baru.

Nilai berikut wajib berupa secret kuat: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QR_SIGNING_SECRET`, dan `APP_ENCRYPTION_KEY`. `APP_ENCRYPTION_KEY` adalah 32 byte dalam base64. Jangan memasukkan secret Xendit ke variabel `NEXT_PUBLIC_*`.

## Xendit

Payment Request menggunakan `POST /v3/payment_requests`, header `api-version: 2024-11-11`, channel `QRIS`, dan idempotency key internal. Daftarkan Payment Status webhook ke:

`https://DOMAIN/api/v1/webhooks/xendit/payments`

API memverifikasi `x-callback-token`, menyimpan event unik, mencocokkan amount/currency/business ID, dan menerbitkan tiket secara idempoten. Secret serta QR string disimpan terenkripsi.

## Database

Backup harian:

```bash
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file=ticketing.dump
```

Restore drill:

```bash
createdb ticketing_restore_test
pg_restore --clean --if-exists --no-owner --dbname=ticketing_restore_test ticketing.dump
```

Sesudah restore, jalankan `npx prisma migrate status`, akses `/api/v1/health`, dan periksa count tenant, event, registration, payment sukses, serta ticket.

`prisma/rls.sql` opsional. Aktifkan hanya jika setiap transaksi memakai `SET LOCAL app.tenant_id` pada koneksi yang transaction-pinned; gunakan role owner/BYPASSRLS terpisah untuk migrasi dan pekerjaan global.

## Batas tahap ini

Ionic/Capacitor sengaja ditahan sesuai instruksi. Kontrak `sync_key` dan endpoint check-in telah disiapkan di backend Next.js untuk integrasi berikutnya.
