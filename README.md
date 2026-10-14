# agent-mods for Claude Code

Five mods for [Claude Code](https://claude.com/claude-code), each sold on its own. English or German.

| Mod | What it does | Price |
|---|---|---|
| **modellwahl** (model choice) | Picks the Claude model per task: small talk on small models, coding on Sonnet or above (unless you force `!haiku`), hard work on the large model. To sort a prompt it asks a small Claude model through your own Claude Code session. | 19 € |
| **lagezeile** (usage line) | One quiet line with context, 5-hour and weekly usage and session cost – only when the values changed. Local only. | **free** |
| **fangnetz** (safety net) | Before `rm`, `git reset --hard`, `git clean`, overwriting `mv`/`cp` and similar commands it shows what would be hit and first saves a verified local copy (within size and time limits; not a replacement for backups). `/fangnetz restore` brings files back. | 19 € |
| **next-steps** | Up to 3 numbered next steps above the prompt. A digit puts the step into the prompt box – you press Enter yourself. No network. | 9 € |
| **nachweis** (record) | A local, hash-chained record of tool calls (secrets masked by pattern, not exhaustive) and prompts (keyed checksum only). Internally consistent, not tamper-proof on its own. | 19 € |

**Get them:** [Gumroad store](https://hchristian.gumroad.com) · for businesses only (§ 14 BGB) · the bundle of the first three mods is still available there.

## Installation
Unzip the package of a mod (here `fangnetz`), then in Claude Code:
```
/plugin marketplace add <folder>/fangnetz
/plugin install fangnetz@fangnetz
```

## Check the signature
Every package comes with `<mod>-<version>.zip.sig` (OpenSSH ed25519, namespace `heilig-software`, identity `christian-heilig`).

Fingerprint: `SHA256:EVgO6x73TrL+5ANSjeE22FhVcy9hxPudW6VeVGhFqkw`

```
ssh-keygen -lf christian-heilig.pub          # must show the fingerprint above
printf 'christian-heilig namespaces="heilig-software" %s\n' "$(cat christian-heilig.pub)" > allowed_signers
ssh-keygen -Y verify -f allowed_signers -I christian-heilig -n heilig-software \
  -s fangnetz-1.0.0.zip.sig < fangnetz-1.0.0.zip
```
The public key `christian-heilig.pub` is in this repository.

---

# agent-mods für Claude Code

Fünf Mods für Claude Code, jeder einzeln erhältlich: **modellwahl** (wählt das Modell je Aufgabe, 19 €), **lagezeile** (ruhige Verbrauchszeile, **kostenlos**), **fangnetz** (zeigt vor `rm`, `git reset --hard` u. Ä., was getroffen würde, und legt zuerst eine geprüfte lokale Kopie an – innerhalb von Größen- und Zeitgrenzen, ersetzt keine Datensicherung; 19 €), **next-steps** (nächste Schritte über dem Eingabefeld, 9 €), **nachweis** (lokales, hash-verkettetes Protokoll, 19 €). Deutsch oder Englisch.

**Holen:** [Gumroad-Laden](https://hchristian.gumroad.com) · nur für Unternehmer (§ 14 BGB)

Verkäufer / Seller: Christian Heilig, Previsa KI (Einzelunternehmen), Clara-Schumann-Straße 11, 97241 Bergtheim, Deutschland, kontakt@previsa.de · Impressum: [previsa.de/#impressum](https://previsa.de/#impressum)

Unabhängiges Produkt, nicht von Anthropic. Claude und Claude Code sind Marken von Anthropic. / Independent product, not made or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic.

Licence / Lizenz: proprietary, see `LICENSE` in the package. This repository contains no source code.
