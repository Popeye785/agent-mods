// Reine Textlogik der Lagezeile – ohne $, einzeln testbar.
export type Fenster = { kind: string; percentUsed: number }
export type CodexTeil = { kurz?: number; lang?: number; veraltet?: boolean }
export type Lage = { kontextProzent?: number; fenster: Fenster[]; usd?: number; codex?: CodexTeil }

const NAME: Record<string, string> = { five_hour: '5h', seven_day: 'Woche', spend_limit: 'Limit' }
const rund = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

/** Eine Zeile. undefined = nichts Belegbares zu zeigen (nie etwas erfinden). */
export function zeile(l: Lage): string | undefined {
  const teile: string[] = []
  if (typeof l.kontextProzent === 'number' && Number.isFinite(l.kontextProzent)) teile.push(`Kontext ${Math.round(l.kontextProzent)} %`)
  for (const k of ['five_hour', 'seven_day', 'spend_limit']) {
    const w = l.fenster.find(f => f.kind === k && Number.isFinite(f.percentUsed))
    if (w) teile.push(`${NAME[k]} ${rund(w.percentUsed)} %`)
  }
  const c = l.codex
  if (c && (Number.isFinite(c.kurz) || Number.isFinite(c.lang))) {
    const t: string[] = []
    if (Number.isFinite(c.kurz)) t.push(`5h ${rund(c.kurz as number)} %`)
    if (Number.isFinite(c.lang)) t.push(`Woche ${rund(c.lang as number)} %`)
    teile.push(`Codex ${t.join(' ')}${c.veraltet ? ' (alter Stand)' : ''}`)
  }
  if (typeof l.usd === 'number' && Number.isFinite(l.usd)) teile.push(`Sitzung ${l.usd.toFixed(2).replace('.', ',')} $`)
  return teile.length ? `📊 ${teile.join(' · ')}` : undefined
}
