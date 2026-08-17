import { Decimal } from '@prisma/client/runtime/library'

export function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return value.toNumber()
}
