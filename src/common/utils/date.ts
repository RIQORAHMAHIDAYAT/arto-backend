const DAY_MS = 86_400_000

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function parseEndOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`)
}

export function startOfDayUtc(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function daysBetweenInclusive(from: Date, to: Date): number {
  const diff = Math.round((startOfDayUtc(to).getTime() - startOfDayUtc(from).getTime()) / DAY_MS)
  return Math.max(0, diff) + 1
}

export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function formatMonthShort(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
