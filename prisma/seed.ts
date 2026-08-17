import { PrismaClient, TransactionType } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const DEMO_EMAIL = 'demo@arto.id'
export const DEMO_PASSWORD = 'demopass123'
export const ADMIN_EMAIL = 'admin@arto.id'
export const ADMIN_PASSWORD = 'adminpass123'

const SYSTEM_CATEGORIES: Array<{ name: string; type: TransactionType; icon: string }> = [
  { name: 'Makanan', type: 'expense', icon: '🍜' },
  { name: 'Transportasi', type: 'expense', icon: '🚌' },
  { name: 'Belanja', type: 'expense', icon: '🛍️' },
  { name: 'Tagihan', type: 'expense', icon: '🧾' },
  { name: 'Pendidikan', type: 'expense', icon: '📚' },
  { name: 'Kesehatan', type: 'expense', icon: '💊' },
  { name: 'Hiburan', type: 'expense', icon: '🎬' },
  { name: 'Gaji', type: 'income', icon: '💰' },
  { name: 'Lainnya', type: 'expense', icon: '📦' },
]

function dateOnly(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return toDateOnly(d)
}

function toDateOnly(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function upsertSystemCategories(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const c of SYSTEM_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { userId: null, name: c.name } })
    const cat =
      existing ??
      (await prisma.category.create({
        data: { name: c.name, type: c.type, icon: c.icon, userId: null },
      }))
    map.set(c.name, cat.id)
  }
  return map
}

async function main(): Promise<void> {
  const categoryIds = await upsertSystemCategories()

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
        name: 'Admin ARTO',
        role: 'ADMIN',
      },
    })
    console.log(`Seeded admin: ${ADMIN_EMAIL}`)
  }

  const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (demo) {
    console.log(`Demo user sudah ada: ${DEMO_EMAIL}`)
    return
  }

  const userId = (
    await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
        name: 'Demo User',
      },
    })
  ).id

  const now = new Date()
  const monthStart = toDateOnly(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEnd = toDateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0))

  const accounts = await prisma.$transaction([
    prisma.account.create({ data: { userId, name: 'Uang Tunai', type: 'cash', initialBalance: 250_000 } }),
    prisma.account.create({ data: { userId, name: 'Bank BCA', type: 'bank', initialBalance: 3_000_000 } }),
    prisma.account.create({ data: { userId, name: 'OVO', type: 'ewallet', initialBalance: 150_000 } }),
  ])

  const accountByName = (name: string): string => {
    const acc = accounts.find((a) => a.name === name)
    if (!acc) throw new Error(`account not found: ${name}`)
    return acc.id
  }
  const accCash = accountByName('Uang Tunai')
  const accBank = accountByName('Bank BCA')
  const accOvo = accountByName('OVO')

  const cat = (name: string): string => {
    const id = categoryIds.get(name)
    if (!id) throw new Error(`category not found: ${name}`)
    return id
  }

  const seedTransactions: Array<{
    category: string
    type: TransactionType
    amount: number
    dayOffset: number
    note: string | null
    accountId: string
  }> = [
    { category: 'Gaji', type: 'income', amount: 4_500_000, dayOffset: -25, note: 'Gaji bulan ini', accountId: accBank },
    { category: 'Makanan', type: 'expense', amount: 45_000, dayOffset: -24, note: 'Makan siang', accountId: accOvo },
    { category: 'Transportasi', type: 'expense', amount: 20_000, dayOffset: -23, note: 'Gojek kantor', accountId: accOvo },
    { category: 'Tagihan', type: 'expense', amount: 350_000, dayOffset: -21, note: 'Listrik', accountId: accBank },
    { category: 'Belanja', type: 'expense', amount: 180_000, dayOffset: -19, note: 'Kaos', accountId: accBank },
    { category: 'Makanan', type: 'expense', amount: 35_000, dayOffset: -17, note: 'Sarapan', accountId: accCash },
    { category: 'Hiburan', type: 'expense', amount: 60_000, dayOffset: -15, note: 'Nonton bioskop', accountId: accOvo },
    { category: 'Kesehatan', type: 'expense', amount: 120_000, dayOffset: -12, note: 'Vitamin', accountId: accBank },
    { category: 'Makanan', type: 'expense', amount: 55_000, dayOffset: -10, note: 'Makan malam', accountId: accCash },
    { category: 'Transportasi', type: 'expense', amount: 15_000, dayOffset: -9, note: 'Angkot', accountId: accCash },
    { category: 'Makanan', type: 'expense', amount: 40_000, dayOffset: -7, note: 'Makan siang', accountId: accOvo },
    { category: 'Tagihan', type: 'expense', amount: 150_000, dayOffset: -6, note: 'Pulsa & kuota', accountId: accBank },
    { category: 'Pendidikan', type: 'expense', amount: 250_000, dayOffset: -5, note: 'Buku', accountId: accBank },
    { category: 'Makanan', type: 'expense', amount: 50_000, dayOffset: -4, note: 'Kopi & kue', accountId: accOvo },
    { category: 'Belanja', type: 'expense', amount: 95_000, dayOffset: -3, note: 'Alat tulis', accountId: accBank },
    { category: 'Hiburan', type: 'expense', amount: 30_000, dayOffset: -2, note: 'Langganan streaming', accountId: accBank },
    { category: 'Transportasi', type: 'expense', amount: 22_000, dayOffset: -1, note: 'Grab', accountId: accOvo },
    { category: 'Makanan', type: 'expense', amount: 25_000, dayOffset: -1, note: 'Sarapan', accountId: accCash },
  ]

  await prisma.transaction.createMany({
    data: seedTransactions.map((t) => ({
      userId,
      accountId: t.accountId,
      categoryId: cat(t.category),
      type: t.type,
      amount: t.amount,
      transactionDate: new Date(`${dateOnly(t.dayOffset)}T00:00:00.000Z`),
      note: t.note,
    })),
  })

  await prisma.$transaction([
    prisma.budget.create({
      data: { userId, categoryId: cat('Makanan'), amount: 1_000_000, periodStart: new Date(`${monthStart}T00:00:00.000Z`), periodEnd: new Date(`${monthEnd}T23:59:59.000Z`) },
    }),
    prisma.budget.create({
      data: { userId, categoryId: cat('Transportasi'), amount: 400_000, periodStart: new Date(`${monthStart}T00:00:00.000Z`), periodEnd: new Date(`${monthEnd}T23:59:59.000Z`) },
    }),
    prisma.budget.create({
      data: { userId, categoryId: cat('Tagihan'), amount: 800_000, periodStart: new Date(`${monthStart}T00:00:00.000Z`), periodEnd: new Date(`${monthEnd}T23:59:59.000Z`) },
    }),
    prisma.budget.create({
      data: { userId, categoryId: cat('Hiburan'), amount: 300_000, periodStart: new Date(`${monthStart}T00:00:00.000Z`), periodEnd: new Date(`${monthEnd}T23:59:59.000Z`) },
    }),
  ])

  await prisma.$transaction([
    prisma.financialGoal.create({
      data: { userId, name: 'Tabungan Laptop', targetAmount: 10_000_000, currentAmount: 6_500_000, deadline: new Date(`${dateOnly(300)}T00:00:00.000Z`) },
    }),
    prisma.financialGoal.create({
      data: { userId, name: 'Dana Darurat', targetAmount: 15_000_000, currentAmount: 3_000_000, deadline: null },
    }),
    prisma.financialGoal.create({
      data: { userId, name: 'Liburan', targetAmount: 5_000_000, currentAmount: 5_000_000, deadline: new Date(`${toDateOnly(new Date(now.getFullYear(), now.getMonth(), 20))}T00:00:00.000Z`) },
    }),
  ])

  console.log(`Seeded demo user: ${DEMO_EMAIL}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
