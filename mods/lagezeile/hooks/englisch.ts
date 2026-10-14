// Englische Anzeige der Lagezeile (reine Logik, ohne $). Wird vor dem Namen angewandt, damit der Name unverändert bleibt.
import type { Sprache } from './einstellungen'

export function aufEnglisch(text: string): string {
  return text
    .replace(/Kontext (\d+) %/g, 'Context $1 %')
    .replace(/Woche ([\d,]+) %/g, 'week $1 %')
    .replace(/\(alter Stand\)/g, '(stale)')
    .replace(/Sitzung ([\d,]+) \$/g, 'Session $$$1')
    .replace(/(\d),(\d)/g, '$1.$2')
}

/** Unbekannte Sprache zählt als Englisch (Standard des Produkts). */
export const inSprache = (s: Sprache | undefined, text: string) => (s === 'de' ? text : aufEnglisch(text))
