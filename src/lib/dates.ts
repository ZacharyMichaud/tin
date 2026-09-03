// done_on values are 'YYYY-MM-DD' local calendar days; all math happens on
// local dates so "yesterday 11pm" counts as 1 day ago.

function toStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function todayLocal(): string {
  return toStr(new Date())
}

export function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from a to b (positive when b is later). DST-safe via rounding. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseLocal(b).getTime() - parseLocal(a).getTime()) / 86_400_000)
}

export function daysSince(s: string): number {
  return daysBetween(s, todayLocal())
}

export function addDays(s: string, n: number): string {
  const d = parseLocal(s)
  d.setDate(d.getDate() + n)
  return toStr(d)
}

export function fmtAgo(n: number): string {
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  return `${n} days ago`
}

export function fmtDay(s: string): string {
  return parseLocal(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: parseLocal(s).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

/** A deadline the way you'd say it out loud: "today", "Friday", "Sep 12". */
export function fmtDue(s: string): string {
  const n = daysBetween(todayLocal(), s)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  // inside the coming week a weekday is easier to place than a date
  if (n > 1 && n < 7) return parseLocal(s).toLocaleDateString(undefined, { weekday: 'long' })
  return fmtDay(s)
}
