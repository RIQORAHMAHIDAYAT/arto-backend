import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'

/**
 * Happy-path end-to-end: register → login → akun → transaksi → budget
 * (termasuk tolak-overlap) → daily-limit → dashboard → rotasi refresh
 * → logout. Menjalankan pipeline global yang sama dengan main.ts.
 */
describe('ARTO API (e2e)', () => {
  let app: INestApplication
  let server: ReturnType<typeof request>

  // Email unik per-run agar suite idempotent terhadap data sisa sebelumnya.
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const password = 'PasswordE2E123!'
  const userA = { email: `e2e-a-${runId}@test.local`, name: 'E2E User A' }
  const userB = { email: `e2e-b-${runId}@test.local`, name: 'E2E User B' }

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate()}`
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()

    // Pipeline identik dengan main.ts agar perilaku e2e = produksi.
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }))
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    server = request(app.getHttpServer()) as unknown as ReturnType<typeof request>
  })

  afterAll(async () => {
    await app.close()
  })

  let accessTokenA = ''
  let refreshTokenA = ''
  let accountId = ''
  let categoryId = ''
  let _transactionId = ''
  let budgetId = ''

  it('register user A mengembalikan sesi lengkap', async () => {
    const res = await server.post('/api/auth/register').send({ ...userA, password })
    expect(res.status).toBe(201)
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
    expect(res.body.user.email).toBe(userA.email)
    accessTokenA = res.body.accessToken
    refreshTokenA = res.body.refreshToken
  })

  it('login menolak password salah lalu menerima yang benar', async () => {
    const bad = await server.post('/api/auth/login').send({ email: userA.email, password: 'SalahTotal123' })
    expect(bad.status).toBe(401)
    expect(bad.body.code).toBe('INVALID_CREDENTIALS')

    const good = await server.post('/api/auth/login').send({ email: userA.email, password })
    expect(good.status).toBe(200)
    expect(good.body.accessToken).toBeTruthy()
  })

  it('GET /users/me mengenali token A', async () => {
    const res = await server.get('/api/users/me').set('Authorization', `Bearer ${accessTokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe(userA.email)
  })

  it('membuat akun kas', async () => {
    const res = await server
      .post('/api/accounts')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ name: 'Kas E2E', type: 'cash', initialBalance: 100000 })
    expect(res.status).toBe(201)
    expect(Number(res.body.balance)).toBe(100000)
    accountId = res.body.id
  })

  it('mengambil satu kategori pengeluaran sistem', async () => {
    const res = await server.get('/api/categories?type=expense').set('Authorization', `Bearer ${accessTokenA}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    categoryId = res.body[0].id
  })

  it('mencatat transaksi pengeluaran', async () => {
    const res = await server
      .post('/api/transactions')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ accountId, categoryId, type: 'expense', amount: 20000, transactionDate: today, note: 'belanja e2e' })
    expect(res.status).toBe(201)
    _transactionId = res.body.id
  })

  it('membuat budget bulan ini untuk kategori tsb', async () => {
    const res = await server
      .post('/api/budgets')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ categoryId, amount: 500000, periodStart: monthStart, periodEnd: monthEnd })
    expect(res.status).toBe(201)
    expect(Number(res.body.spent)).toBe(20000)
    budgetId = res.body.id
  })

  it('menolak budget kedua yang beririsan (409 DUPLICATE_BUDGET)', async () => {
    const res = await server
      .post('/api/budgets')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({ categoryId, amount: 100000, periodStart: monthStart, periodEnd: monthEnd })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('DUPLICATE_BUDGET')
  })

  it('daily-limit menghitung sisa harian', async () => {
    const res = await server
      .get(`/api/budgets/${budgetId}/daily-limit`)
      .set('Authorization', `Bearer ${accessTokenA}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.dailyLimit).toBe('number')
    expect(res.body.categoryName).toBeTruthy()
  })

  it('dashboard summary dapat diakses', async () => {
    const res = await server.get('/api/dashboard/summary').set('Authorization', `Bearer ${accessTokenA}`)
    expect(res.status).toBe(200)
  })

  it('user B tidak bisa membaca budget milik user A (ownership)', async () => {
    const regB = await server.post('/api/auth/register').send({ ...userB, password })
    expect(regB.status).toBe(201)

    const res = await server.get(`/api/budgets/${budgetId}`).set('Authorization', `Bearer ${regB.body.accessToken}`)
    expect(res.status).toBe(404)
  })

  it('refresh merotasi pasangan token; token lama tidak bisa dipakai lagi', async () => {
    const res = await server.post('/api/auth/refresh').send({ refreshToken: refreshTokenA })
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
    const newRefreshToken = res.body.refreshToken as string
    expect(newRefreshToken).not.toBe(refreshTokenA)

    const reuse = await server.post('/api/auth/refresh').send({ refreshToken: refreshTokenA })
    expect(reuse.status).toBe(401)

    refreshTokenA = newRefreshToken
  })

  it('logout merevoke sesi sehingga refresh berikutnya gagal', async () => {
    const logout = await server.post('/api/auth/logout').send({ refreshToken: refreshTokenA })
    expect([200, 204]).toContain(logout.status)

    const afterLogout = await server.post('/api/auth/refresh').send({ refreshToken: refreshTokenA })
    expect(afterLogout.status).toBe(401)
  })
})
