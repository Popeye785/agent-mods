// Gemeinsame Einstellungen aller Mods dieses Pakets – reine Logik ohne $, einzeln testbar.
// Ordner: $XDG_CONFIG_HOME/agent-mods (sonst ~/.config/agent-mods)
//   config.json   { "name": "…", "language": "de" | "en" }  → Anzeigename und Sprache der Anzeigen
//                 (ohne "language": Systemsprache aus LC_ALL / LC_MESSAGES / LANG; deutsch nur bei de_*, sonst englisch)
//   <mod>.off     Not-Aus-Datei: liegt sie dort, tut der Mod nichts
// Diese Datei liegt wortgleich in jedem Mod (Mods teilen keinen Code untereinander).

export const ORDNER_NAME = 'agent-mods'
export const KONFIG_MAX_BYTES = 4096
const NAME_MAX = 40

/** Einstellungsordner; undefined, wenn weder XDG_CONFIG_HOME noch HOME ein absoluter Pfad ist. */
export function konfigOrdner(home: unknown, xdg: unknown): string | undefined {
  const sauber = (p: unknown) => (typeof p === 'string' && p.startsWith('/') ? p.replace(/\/+$/, '') : undefined)
  const x = sauber(xdg)
  if (x !== undefined) return `${x}/${ORDNER_NAME}`
  const h = sauber(home)
  return h !== undefined ? `${h}/.config/${ORDNER_NAME}` : undefined
}

export const ausDatei = (ordner: string, mod: string) => `${ordner}/${mod}.off`
export const konfigDatei = (ordner: string) => `${ordner}/config.json`

/** Zeichen, die nie in die Anzeige dürfen: Steuerzeichen, Zeilentrenner, Richtungs- und unsichtbare Formatzeichen. */
export function verboten(c: number): boolean {
  return c < 32 || (c >= 0x7f && c <= 0x9f) || c === 0xad || c === 0x061c || c === 0x180e ||
    (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) ||
    c === 0xfeff || (c >= 0xfff9 && c <= 0xfffb) || (c >= 0xe0000 && c <= 0xe007f)
}

/** Länge eines Textes in UTF-8-Bytes (die Datei kann zwischen Prüfen und Lesen gewachsen sein). */
export function utf8Bytes(t: string): number {
  let n = 0
  for (const ch of t) { const c = ch.codePointAt(0) ?? 0; n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4 }
  return n
}

/** Anzeigename aus dem Text von config.json. Alles Unerwartete → undefined (dann ohne Namen). */
export function anzeigeName(text: unknown): string | undefined {
  if (typeof text !== 'string' || text.length > KONFIG_MAX_BYTES || utf8Bytes(text) > KONFIG_MAX_BYTES) return undefined
  let j: unknown
  try { j = JSON.parse(text) } catch { return undefined }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return undefined
  const n = (j as Record<string, unknown>).name
  if (typeof n !== 'string') return undefined
  // Verbotene Zeichen werden zu Leerraum, Leerraum wird zusammengezogen, Länge in ganzen Zeichen begrenzt.
  const zeichen = Array.from(n).map(ch => (verboten(ch.codePointAt(0) ?? 0) ? ' ' : ch))
  const s = zeichen.join('').split(/\s+/).filter(Boolean).join(' ')
  const kurz = Array.from(s).slice(0, NAME_MAX).join('').trim()
  return kurz || undefined
}

/** Zeile mit Namen davor; ohne Namen unverändert. */
export const mitName = (name: string | undefined, zeile: string) => (name ? `${name} · ${zeile}` : zeile)

export type Sprache = 'de' | 'en'
export type Einstellungen = { aus: boolean; name?: string; home?: string; sprache: Sprache }

/** "language" aus dem Text von config.json, falls gültig. */
export function konfigSprache(text: unknown): Sprache | undefined {
  if (typeof text !== 'string' || text.length > KONFIG_MAX_BYTES || utf8Bytes(text) > KONFIG_MAX_BYTES) return undefined
  try {
    const j = JSON.parse(text)
    const l = j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>).language : undefined
    return l === 'de' || l === 'en' ? l : undefined
  } catch { return undefined }
}

/** Sprache aus Umgebungswerten (Reihenfolge wie POSIX: LC_ALL, LC_MESSAGES, LANG); nur gültige Locale-Namen zählen. */
export function systemSprache(werte: unknown[]): Sprache {
  for (const w of werte) {
    if (typeof w !== 'string') continue
    if (/^(C|POSIX)([_.@-]|$)/.test(w)) return 'en'   // gesetzt, aber ohne Sprache: zählt, POSIX-Vorrang bleibt
    if (!/^[a-z]{2,3}([_.@-]|$)/i.test(w)) continue
    return /^de([_.@-]|$)/i.test(w) ? 'de' : 'en'
  }
  return 'en'
}
