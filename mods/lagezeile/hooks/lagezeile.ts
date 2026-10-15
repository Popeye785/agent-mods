import type { Register } from 'claude-code'
import { registerBand } from './band.tsx'
import { zeile } from './logik.ts'
import { ausDatei, anzeigeName, KONFIG_MAX_BYTES, konfigSprache, systemSprache, konfigDatei, konfigOrdner, mitName } from './einstellungen.ts'
import type { Einstellungen, Sprache } from './einstellungen.ts'
import type { CodexTeil } from './logik.ts'
import { fromEvent, isRolloutName, joinPath, lastRateLimitEvent, MAX_DAY_DIRS, MAX_FILES_SCANNED, MAX_TOTAL_SCAN_BYTES, PER_FILE_BYTES } from './codex-quota.ts'
import { inSprache } from './englisch.ts'

// Liest Einstellungen; muss in derselben Datei stehen wie der Hook (die Mod-Engine folgt $ nicht über Importe).
/** Ein Aufruf, der auch synchron werfen darf, mit Frist. ok:false bei Fehler oder Hänger. */
function sicher<T>(f: () => T | Promise<T>, ms: number): Promise<{ ok: boolean; v?: T }> {
  return new Promise(res => {
    const t = globalThis.setTimeout(() => res({ ok: false }), ms)
    const fertig = (x: { ok: boolean; v?: T }) => { globalThis.clearTimeout(t); res(x) }
    try { Promise.resolve(f()).then(v => fertig({ ok: true, v }), () => fertig({ ok: false })) } catch { fertig({ ok: false }) }
  })
}

/**
 * Liest Not-Aus und Anzeigenamen für einen Mod, insgesamt höchstens `ms` Millisekunden.
 * undefined = Ordner nicht sicher bestimmbar oder Not-Aus nicht prüfbar → der Mod tut nichts (fail-open).
 * config.json wird nur gelesen, wenn sie klein ist (KONFIG_MAX_BYTES); sonst gibt es keinen Namen.
 */
let konfigLesend = false
let letzterName: string | undefined
let letzteSprache: Sprache | undefined   // aus config.json
async function liesEinstellungen($: any, mod: string, ms: number): Promise<Einstellungen | undefined> {
  const bis = Date.now() + ms
  const rest = () => Math.max(1, bis - Date.now())
  const xdg = await sicher(() => $.env.get('XDG_CONFIG_HOME'), rest())
  if (!xdg.ok) return undefined
  const home = await sicher(() => $.env.get('HOME'), rest())
  if (!home.ok) return undefined
  const ordner = konfigOrdner(home.v, xdg.v)
  if (!ordner) return undefined
  const aus = await sicher(() => $.fs.exists(ausDatei(ordner, mod)), rest())
  if (!aus.ok || typeof aus.v !== 'boolean') return undefined
  const heim = typeof home.v === 'string' ? home.v : undefined
  // Systemsprache (LC_ALL, LC_MESSAGES, LANG) – auch bei Not-Aus, damit z. B. /modellwahl richtig spricht.
  const systemSpracheLesen = async (): Promise<Sprache> => {
    const lcAll = await sicher(() => $.env.get('LC_ALL'), rest())
    const lcMessages = await sicher(() => $.env.get('LC_MESSAGES'), rest())
    const lang = await sicher(() => $.env.get('LANG'), rest())
    return systemSprache([lcAll, lcMessages, lang].map(w => (w.ok ? w.v : undefined)))
  }
  // config.json (Name, Sprache) – auch bei Not-Aus wegen der Sprache. Nur aus einer kleinen, echten Datei; höchstens ein Lesevorgang gleichzeitig (ein hängender blockiert keinen
  // weiteren Aufruf, es bleibt dann der zuletzt gelesene Name). Die Engine selbst lehnt jedes Lesen über 4 MiB ab.
  const st: any = await sicher(() => $.fs.stat(konfigDatei(ordner)), rest())
  if (!st.ok || st.v?.kind !== 'file' || typeof st.v.size !== 'number' || st.v.size > KONFIG_MAX_BYTES) { letzterName = undefined; letzteSprache = undefined }
  else if (!konfigLesend) {
    konfigLesend = true
    const lesen = Promise.resolve().then(() => $.fs.read(konfigDatei(ordner)))
    lesen.then(() => { konfigLesend = false }, () => { konfigLesend = false })
    const text = await sicher(() => lesen, rest())
    if (text.ok) { letzterName = anzeigeName(text.v); letzteSprache = konfigSprache(text.v) }
  }
  if (aus.v) return { aus: true, home: heim, sprache: letzteSprache ?? (await systemSpracheLesen()) }
  return { aus: false, name: letzterName, home: heim, sprache: letzteSprache ?? (await systemSpracheLesen()) }
}


// Nach jeder fertigen Antwort der Hauptschleife EINE Gesprächszeile (dim). Nur wenn sich der Text geändert hat.
// Fail-open: jeder Fehler/Hänger lässt alles unverändert durch. Kein ask, kein deny, keine Modellaufrufe, kein Netz.
// Not-Aus: Datei ~/.config/agent-mods/lagezeile.off · Anzeigename: ~/.config/agent-mods/config.json
const FRIST_MS = 300
const GESAMT_MS = 1000
type Ctl = { stop: boolean; listings: number }
let zuletzt = ''
const CODEX_ALLE_MS = 5 * 60_000
let codexStand: { bis: number; teil?: CodexTeil } | undefined
export const vergessen = () => { zuletzt = ''; codexStand = undefined; konfigLesend = false; letzterName = undefined; letzteSprache = undefined }

const mitFrist = <T,>(p: Promise<T>, ms: number): Promise<T | undefined> =>
  new Promise(res => { const t = globalThis.setTimeout(() => res(undefined), ms); p.then(v => { globalThis.clearTimeout(t); res(v) }, () => { globalThis.clearTimeout(t); res(undefined) }) })

// ---- Codex-Verbrauch: nur lesen aus ~/.codex/sessions (Port von quota-router@55e6eaab, MIT – siehe THIRD_PARTY_NOTICES.md) ----
const MAX_LISTINGS = 80

async function dirs($: any, path: string, ctl: Ctl): Promise<string[]> {
  if (ctl.stop || ctl.listings++ >= MAX_LISTINGS) return []
  const es: any[] = await $.fs.list(path).catch(() => [])
  return es.filter(e => e.kind === 'dir' && !e.isLink).map(e => e.name as string).sort().reverse()
}

async function liesCodex($: any, jetztMs: number, ctl: Ctl): Promise<CodexTeil | undefined> {
  try {
    const ch = await $.env.get('CODEX_HOME').catch(() => undefined)
    const home = await $.env.get('HOME').catch(() => undefined)
    const root = ch ? joinPath(ch, 'sessions') : home ? joinPath(joinPath(home, '.codex'), 'sessions') : null
    if (!root || !(await $.fs.exists(root).catch(() => false))) return undefined
    const files: { path: string; size: number; mtimeMs: number }[] = []
    let days = 0
    outer: for (const y of await dirs($, root, ctl)) {
      const yp = joinPath(root, y)
      for (const m of await dirs($, yp, ctl)) {
        const mp = joinPath(yp, m)
        for (const d of await dirs($, mp, ctl)) {
          if (days++ >= MAX_DAY_DIRS) break outer
          const dp = joinPath(mp, d)
          if (ctl.stop || ctl.listings++ >= MAX_LISTINGS) break outer
          for (const e of (await $.fs.list(dp).catch(() => [])) as any[])
            if (e.kind === 'file' && !e.isLink && isRolloutName(e.name)) files.push({ path: joinPath(dp, e.name), size: e.size, mtimeMs: e.mtimeMs })
        }
      }
    }
    files.sort((a, b) => b.mtimeMs - a.mtimeMs)
    let gelesen = 0
    for (const f of files.slice(0, MAX_FILES_SCANNED)) {
      if (ctl.stop) return undefined
      const budget = Math.min(PER_FILE_BYTES, MAX_TOTAL_SCAN_BYTES - gelesen)
      if (budget <= 0) break
      // Frische Größe unmittelbar vor dem Lesen (die Listen-Größe kann veraltet sein).
      const st: any = await $.fs.stat(f.path).catch(() => null)
      const echt = typeof st?.size === 'number' ? st.size : f.size
      if (ctl.stop) return undefined
      if (echt > budget) continue
      const text = await $.fs.read(f.path).catch(() => null)
      if (ctl.stop) return undefined
      gelesen += typeof text === 'string' ? Math.max(echt, text.length) : echt
      if (typeof text !== 'string' || text.length > PER_FILE_BYTES) continue
      const found = lastRateLimitEvent(text)
      if (!found) continue
      const q = fromEvent(found, f.mtimeMs / 1000, jetztMs / 1000, f.path)
      const k = q.windows?.short, l = q.windows?.long
      if (!k && !l) return undefined
      return { kurz: k && !k.stale ? k.usedPercent : undefined, lang: l && !l.stale ? l.usedPercent : undefined, veraltet: (q.snapshotAgeSeconds ?? 0) >= 3600 }
    }
  } catch {}
  return undefined
}

export async function nachAntwort($: any, e: any, next: (e: any) => Promise<any>) {
    const r = await next(e)
    try {
      if (e.agentId !== undefined) return r
      const bis = Date.now() + GESAMT_MS   // alles zusammen höchstens GESAMT_MS nach der Antwort
      const rest = () => Math.max(1, bis - Date.now())
      const ein = await liesEinstellungen($, 'lagezeile', Math.min(FRIST_MS, rest()))
      if (!ein || ein.aus) return r
      const u: any = await mitFrist(Promise.resolve($.session.usage()), Math.min(FRIST_MS, rest()))
      if (!u) return r
      const jetzt = Date.now()
      if (!codexStand || codexStand.bis < jetzt) {
        const ctl: Ctl = { stop: false, listings: 0 }
        const teil = await mitFrist(liesCodex($, jetzt, ctl), rest()) // höchstens alle 5 Min lesen; Hänger = ohne Codex
        ctl.stop = true // nach der Frist liest nichts mehr weiter
        codexStand = { bis: jetzt + CODEX_ALLE_MS, teil }
      }
      const z = zeile({ kontextProzent: u.context?.percent, fenster: u.rateLimits ?? [], usd: u.cost?.usd, codex: codexStand.teil })
      const mz = z ? mitName(ein.name, inSprache(ein.sprache, z)) : undefined
      if (mz && mz !== zuletzt) { zuletzt = mz; $.ui.log(mz) }
    } catch {}
    return r
}

export const register: Register = on => {
  on('turn.complete', nachAntwort).catch(($, e, next) => next(e))
  try { registerBand(on) } catch {}   // Band über der Schreibleiste (Terminal + Desktop-App); nie die Gesprächszeile gefährden
}
