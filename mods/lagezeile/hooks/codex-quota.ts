// Codex quota, read-only, from the newest Codex rollout files on disk.
// Port of quota-router router/codex_quota_probe.py@55e6eaab (github.com/wr/quota-router, MIT, (c) 2026 Wells Riley).
// Never runs Codex, never touches the network, never writes; any failure yields { available: false }.
//
// This file holds the pure parsing; the walk over $.fs lives in register.tsx (the engine follows $ only
// into functions of the hooks module itself).
//
// Deviation from the Python probe: $.fs can only read a whole file (no seek), so instead of reading the
// last 2 MiB of a big file, a file over the per-file budget is skipped and the next-newest one is tried.
// The reading's age is reported so an older fallback stays visible.
import type { CodexQuota, CodexWindow } from '../types'

export const SHORT_MAX_MINUTES = 360 // <=6h counts as the short (5h-style) window
export const MAX_TOTAL_SCAN_BYTES = 4 * 1024 * 1024
export const MAX_FILES_SCANNED = 8 // newest-mtime first
export const PER_FILE_BYTES = 2 * 1024 * 1024 // the Python probe's TAIL_CHUNK * 8
export const MAX_DAY_DIRS = 14 // day folders listed, newest first; bounds the directory walk

type RateLimits = Record<string, unknown>
export type Found = { timestamp: unknown; rateLimits: RateLimits }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// ISO time -> epoch seconds; a time without a zone counts as UTC, as in the Python probe.
export function parseIsoEpoch(ts: unknown): number | null {
  if (typeof ts !== 'string' || ts === '') return null
  const zoned = /([zZ]|[+-]\d\d:?\d\d)$/.test(ts) ? ts : `${ts}Z`
  const ms = Date.parse(zoned)
  return Number.isFinite(ms) ? ms / 1000 : null
}

// The newest token_count rate-limit event in one rollout's text, newest line first.
// A last line with no newline yet may be half-written and is skipped.
export function lastRateLimitEvent(text: string): Found | null {
  const lines = text.split('\n')
  if (!text.endsWith('\n')) lines.pop()
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('token_count')) continue // cheap pre-filter before JSON.parse
    let e: any
    try {
      e = JSON.parse(line)
    } catch {
      continue
    }
    if (!e || e.type !== 'event_msg') continue
    const payload = e.payload ?? {}
    if (payload.type !== 'token_count') continue
    const rl = payload.rate_limits
    if (!rl || typeof rl !== 'object' || Array.isArray(rl)) continue
    return { timestamp: e.timestamp, rateLimits: rl }
  }
  return null
}

export function normWindow(win: unknown, snapEpoch: number | null, now: number): CodexWindow | null {
  if (!win || typeof win !== 'object') return null
  const w = win as Record<string, unknown>
  const used = w.used_percent
  const wmin = w.window_minutes
  if (!isNum(used) || !isNum(wmin)) return null
  let resetEpoch: number | null = isNum(w.resets_at) ? w.resets_at : null
  if (resetEpoch === null) {
    const secs = w.resets_in_seconds
    resetEpoch = isNum(secs) && snapEpoch ? snapEpoch + secs : null
  }
  const out: CodexWindow = {
    role: wmin <= SHORT_MAX_MINUTES ? 'short' : 'long',
    usedPercent: used,
    windowMinutes: wmin,
    stale: false,
    minutesToReset: null,
  }
  if (resetEpoch === null) return out // level known, reset unknown
  if (resetEpoch - now > wmin * 60 * 2 + 3600) return { ...out, stale: true, reason: 'implausible_reset' }
  const delta = resetEpoch - now
  // Rolled over since the snapshot: unknown, NOT zero used.
  if (delta <= 0) return { ...out, stale: true, minutesToReset: 0, reason: 'rolled_over' }
  return { ...out, minutesToReset: Math.ceil(delta / 60) }
}

// Turns one found event into the quota; `fileMtimeSec` stands in for a missing timestamp.
export function fromEvent(found: Found, fileMtimeSec: number, now: number, sourceFile?: string): CodexQuota {
  let snapEpoch = parseIsoEpoch(found.timestamp)
  const usedMtime = snapEpoch === null
  if (snapEpoch === null) snapEpoch = fileMtimeSec
  const windows: CodexQuota['windows'] = {}
  for (const key of ['primary', 'secondary']) {
    const w = normWindow(found.rateLimits[key], snapEpoch, now)
    if (w) windows[w.role] = w
  }
  const plan = found.rateLimits.plan_type
  return {
    available: true,
    reason: 'ok',
    sourceFile,
    snapshotEpoch: snapEpoch,
    snapshotAgeSeconds: Math.max(0, Math.floor(now - snapEpoch)),
    usedMtimeFallback: usedMtime,
    planType: typeof plan === 'string' ? plan : undefined,
    windows,
  }
}

export const joinPath = (a: string, b: string) => `${a.replace(/\/+$/, '')}/${b}`
export const isRolloutName = (name: string) => /^rollout-.*\.jsonl$/.test(name)
