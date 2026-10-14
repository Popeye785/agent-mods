export type CodexWindow = {
  role: 'short' | 'long'
  usedPercent: number
  windowMinutes: number
  stale: boolean // past its reset or an implausible reset: level unknown now
  minutesToReset: number | null
  reason?: string
}
export type CodexQuota = {
  available: boolean
  reason: string
  sourceFile?: string
  snapshotEpoch?: number
  snapshotAgeSeconds?: number
  usedMtimeFallback?: boolean
  planType?: string
  windows?: { short?: CodexWindow; long?: CodexWindow }
}
