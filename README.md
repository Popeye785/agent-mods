# agent-mods for Claude Code

Three mods for [Claude Code](https://claude.com/claude-code). English or German, local only, no telemetry.

| Mod | What it does |
|---|---|
| **modellwahl** (model choice) | Picks the Claude model per task: small talk on small models, coding never below Sonnet, hard work on the large model. `!sonnet`, `!opus`, `!haiku`, `!auto` decide for you. |
| **lagezeile** (status line) | After every answer one quiet line: context, 5-hour and weekly usage, session cost. |
| **fangnetz** (safety net) | Before `rm`, `git reset --hard`, `git clean`, overwriting `mv`/`cp` and similar commands it shows what would be hit and first saves a verified local copy (within size and time limits; not a replacement for backups). Bring files back with `/fangnetz restore`. Never asks, never blocks. |

**Buy:** [Gumroad](https://hchristian.gumroad.com/l/vpayk) · 79 € · for businesses only (§ 14 BGB)

## Installation
Unzip the package, then in Claude Code:
```
/plugin marketplace add <folder>/agent-mods
/plugin install modellwahl@agent-mods
/plugin install lagezeile@agent-mods
/plugin install fangnetz@agent-mods
```

## Check the signature
Every package comes with `agent-mods-<version>.zip.sig` (OpenSSH ed25519, namespace `heilig-software`, identity `christian-heilig`).

Fingerprint: `SHA256:EVgO6x73TrL+5ANSjeE22FhVcy9hxPudW6VeVGhFqkw`

```
ssh-keygen -lf christian-heilig.pub          # must show the fingerprint above
printf 'christian-heilig namespaces="heilig-software" %s\n' "$(cat christian-heilig.pub)" > allowed_signers
ssh-keygen -Y verify -f allowed_signers -I christian-heilig -n heilig-software \
  -s agent-mods-1.0.0.zip.sig < agent-mods-1.0.0.zip
```
The public key `christian-heilig.pub` is in this repository.

---

# agent-mods für Claude Code

Drei Mods für Claude Code: **modellwahl** (wählt das Modell je Aufgabe), **lagezeile** (ruhige Verbrauchszeile nach jeder Antwort), **fangnetz** (zeigt vor `rm`, `git reset --hard` u. Ä., was getroffen würde, und legt zuerst eine geprüfte lokale Kopie an – innerhalb von Größen- und Zeitgrenzen, ersetzt keine Datensicherung). Deutsch oder Englisch, nur lokal, keine Telemetrie.

**Kaufen:** [Gumroad](https://hchristian.gumroad.com/l/vpayk) · 79 € · nur für Unternehmer (§ 14 BGB)

Verkäufer / Seller: Christian Heilig, Previsa KI (Einzelunternehmen), Clara-Schumann-Straße 11, 97241 Bergtheim, Deutschland, kontakt@previsa.de · Impressum: [previsa.de/#impressum](https://previsa.de/#impressum)

Unabhängiges Produkt, nicht von Anthropic. Claude und Claude Code sind Marken von Anthropic. / Independent product, not made or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic.

Licence / Lizenz: proprietary, see `LICENSE` in the package. This repository contains no source code.
