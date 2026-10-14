// Band über der Schreibleiste: Kontext, Verbrauch, Kosten — gezeichnet auf Terminal UND Desktop-App
// (Typdatei: „AbovePrompt … Raised on the terminal and desktop surfaces only“). Nur lesen, fragt nie, sperrt nie.
import type { Register } from 'claude-code'
import { zeile } from './logik'
import { ausDatei, anzeigeName, KONFIG_MAX_BYTES, konfigSprache, systemSprache, konfigDatei, konfigOrdner, mitName } from './einstellungen'
import type { Einstellungen, Sprache } from './einstellungen'
import { inSprache } from './englisch'

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
  const h = typeof home.v === 'string' ? home.v : undefined
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
  if (aus.v) return { aus: true, home: h, sprache: letzteSprache ?? (await systemSpracheLesen()) }
  return { aus: false, name: letzterName, home: h, sprache: letzteSprache ?? (await systemSpracheLesen()) }
}


const FRIST_MS = 800        // EINE Frist für alle Lesevorgänge zusammen: nie die Oberfläche aufhalten
const CACHE_MS = 5000       // höchstens alle 5 s neu lesen (das Band wird oft neu gezeichnet)

type Stand = { text?: string; aus: boolean }

const mitFrist = <T,>(p: Promise<T>, ms: number): Promise<T | undefined> =>
  new Promise(res => {
    const t = setTimeout(() => res(undefined), ms)
    p.then(v => { clearTimeout(t); res(v) }, () => { clearTimeout(t); res(undefined) })
  })

/** Liest Not-Aus und Verbrauch; ein Ergebnis als Ganzes. Fehler → undefined (nichts zeichnen). */
async function lesen($: any): Promise<Stand | undefined> {
  const ein = await liesEinstellungen($, 'lagezeile', FRIST_MS)
  if (!ein) return undefined
  if (ein.aus) return { aus: true }
  const u: any = await $.session.usage()
  if (!u) return undefined
  const z = zeile({ kontextProzent: u.context?.percent, fenster: u.rateLimits ?? [], usd: u.cost?.usd })
  return { aus: false, text: z ? mitName(ein.name, inSprache(ein.sprache, z)) : undefined }
}

export function registerBand(on: Parameters<Register>[0]) {
  let stand: Stand | undefined          // wird nur als Ganzes ersetzt — keine gemischten Zustände
  let gueltigBis = 0
  let laufend: Promise<Stand | undefined> | undefined   // höchstens EIN Lesevorgang gleichzeitig, auch bei Hängern

  on('ui.render', { component: 'AbovePrompt' }, async ($: any, e: any, next: any) => {
    try {
      if (e.props?.hasSurvey) return next(e)
      const jetzt = Date.now()
      if (jetzt >= gueltigBis && !laufend) {
        laufend = lesen($).catch(() => undefined).finally(() => { laufend = undefined })
        const neu = await mitFrist(laufend, FRIST_MS)
        if (neu) { stand = neu; gueltigBis = Date.now() + CACHE_MS }   // Cache erst gültig, wenn fertig gelesen
        else if (jetzt >= gueltigBis) stand = undefined                 // Hänger/Fehler: lieber nichts zeigen als Altes
      }
      if (!stand || stand.aus || !stand.text) return next(e)
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box>
          <Text dimColor>{stand.text}</Text>
        </Box>
      )
    } catch {
      return next(e)
    }
  })
}
