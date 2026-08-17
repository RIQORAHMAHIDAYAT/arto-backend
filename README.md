# ARTO Backend

REST API untuk ARTO — personal financial tracker.

- **Stack:** NestJS + TypeScript + Prisma + PostgreSQL
- **API:** REST (`/api` prefix)
- **Auth:** JWT access token (short-lived) + refresh token rotating, hash disimpan di database

> **Ngerti artone, ngerti uripe.**

## Persyaratan

- Node.js 20+
- PostgreSQL 14+ (lokal / Docker / remote)

## Setup

```bash
npm install
cp .env.example .env   # sesuaikan DATABASE_URL & secret
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run start:dev      # http://localhost:3000/api
```

### PostgreSQL lokal tanpa instalasi (opsional)

Jika belum ada PostgreSQL di sistem, gunakan skrip berikut (Windows):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-postgres.ps1
# berhenti: ... -Stop
```

Skrip mengunduh binaries portable PostgreSQL, membuat cluster dev, dan membuat
role/database `arto` sesuai `.env.example`.

## Scripts

| Perintah            | Deskripsi                                          |
| ------------------- | -------------------------------------------------- |
| `npm run start`     | Menjalankan server (build dulu)                    |
| `npm run start:dev` | Menjalankan server dengan watch mode               |
| `npm run build`     | Build NestJS ke `dist/`                            |
| `npm run typecheck` | Type-check TypeScript                              |
| `npm run lint`      | Oxlint                                             |
| `prisma:migrate`    | `prisma migrate dev` (buat migration baru)         |
| `prisma:deploy`     | `prisma migrate deploy` (terapkan migration)       |
| `db:seed`           | Seeder: kategori sistem + akun demo + akun admin   |
| `db:reset`          | Reset database + seed ulang                        |

## Environment Variables

Lihat `.env.example`:

- `DATABASE_URL` — koneksi PostgreSQL
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL_DAYS`
- `CORS_ORIGINS` — daftar origin yang diizinkan (koma)
- `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` — rate limiting global

Jangan pernah commit secret produksi. Gunakan environment variables.

## Akun Seed

| Peran  | Email          | Password      | Data                                   |
| ------ | -------------- | ------------- | -------------------------------------- |
| Demo   | `demo@arto.id` | `demopass123` | akun, transaksi, budget, goals          |
| Admin  | `admin@arto.id`| `adminpass123`| akses endpoint `/admin/*`               |

## Endpoint

### Auth
- `POST /auth/register` `{ name?, email, password }` → `{ accessToken, refreshToken, user }`
- `POST /auth/login` → `{ accessToken, refreshToken, user }`
- `POST /auth/refresh` `{ refreshToken }` → `{ accessToken, refreshToken }`
- `POST /auth/logout` `{ refreshToken }` → 204

### Users
- `GET /users/me`
- `PATCH /users/me` `{ name?, theme? }`

### Accounts
- `GET /accounts`, `POST /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id`, `DELETE /accounts/:id`

### Categories
- `GET /categories?type=`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`

### Transactions
- `GET /transactions?page&limit&type&categoryId&accountId&from&to&query` (pagination)
- `POST /transactions`, `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id`

### Budgets
- `GET /budgets`, `POST /budgets`, `GET /budgets/:id`, `PATCH /budgets/:id`, `DELETE /budgets/:id`
- `GET /budgets/:id/daily-limit?date=YYYY-MM-DD`
- `GET /budgets/summary`

### Dashboard, Analytics, Health, Goals
- `GET /dashboard/summary`
- `GET /analytics/summary?from&to`
- `GET /analytics/categories?from&to`
- `GET /analytics/trends?from&to&bucket=day|week`
- `GET /financial-health`
- `GET /goals`, `POST /goals`, `GET /goals/:id`, `PATCH /goals/:id`, `DELETE /goals/:id`

### Admin (role ADMIN)
- `GET /admin/overview`
- `GET /admin/users/statistics`
- `GET /admin/transactions/statistics`

## Konvensi

- Semua resource terproteksi memverifikasi kepemilikan (ownership) di layer backend.
- Nilai uang memakai `DECIMAL(18,2)` di database dan dikirim sebagai angka.
- Tanggal transaksi dikirim/diterima sebagai `YYYY-MM-DD`.
- Kategori sistem (`userId: null`) dibagikan untuk semua user dan bersifat read-only.
- Data finansial pribadi tidak pernah diekspos tanpa otorisasi; admin hanya melihat agregasi.