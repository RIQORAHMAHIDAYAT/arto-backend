export function parseDurationToSeconds(value: string | undefined, fallbackSeconds = 900): number {
  const raw = (value ?? '').trim()
  const match = /^(\d+)(s|m|h|d)?$/i.exec(raw)
  if (!match) return fallbackSeconds
  const n = Number(match[1])
  const unit = (match[2] ?? 's').toLowerCase()
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86_400
  return n * multiplier
}