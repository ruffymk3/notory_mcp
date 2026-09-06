# @notory/mcp veroeffentlichen - Anleitung fuer den Inhaber

Der technische Teil ist erledigt (Build, Release-Workflow, MIT-Lizenz, npm-Paketinhalt
geprueft). Es fehlen nur noch Schritte, die ausschliesslich der Kontoinhaber ausfuehren
kann, weil sie ein npm-Konto und Repo-Admin-Rechte brauchen. Diese Anleitung fuehrt
einmalig durch die Erstveroeffentlichung.

Kein Schritt hier wurde von Claude ausgefuehrt. Nichts ist bisher veroeffentlicht.

---

## 1. npm-Organisation `@notory` anlegen

1. Im Browser einloggen auf https://www.npmjs.com/ (mit dem npm-Account, der spaeter
   `@notory/mcp` verwalten soll - falls noch kein npm-Account existiert, vorher unter
   https://www.npmjs.com/signup einen anlegen).
2. Oben rechts auf das Profilbild klicken -> **Add Organization**.
3. Organisationsname genau `notory` eingeben (das ergibt den Scope `@notory`).
4. Plan **Free** waehlen (reicht fuer ein oeffentliches Paket).
5. Organisation erstellen. Damit existiert der Scope `@notory` und `@notory/mcp` kann
   spaeter darunter veroeffentlicht werden.

## 2. Automation-Token erzeugen

1. Auf npmjs.com oben rechts aufs Profilbild -> **Access Tokens**.
2. Button **Generate New Token** -> **Granular Access Token** (empfohlen) oder
   **Classic Token**.
3. Bei Granular Access Token:
   - **Name:** z. B. `notory_mcp-github-actions`
   - **Expiration:** z. B. 1 Jahr (npm erzwingt bei Granular Tokens ein Ablaufdatum -
     Termin vormerken, um das Token rechtzeitig zu erneuern)
   - **Packages and scopes -> Permissions:** "Read and write"
   - **Packages and scopes -> Select packages:** entweder "All packages" oder gezielt
     auf den Scope `@notory` einschraenken, sobald das Paket/die Org existiert
   - **Organizations:** Zugriff auf die Organisation `notory` erlauben
4. Bei Classic Token stattdessen den Typ **Automation** waehlen (kein 2FA-Prompt beim
   Publish aus CI, das ist fuer den GitHub-Actions-Workflow noetig).
5. Token generieren lassen und den angezeigten Wert **sofort kopieren** - er wird nur
   einmal angezeigt.

## 3. Token als Repo-Secret `NPM_TOKEN` hinterlegen

1. Im Browser zu https://github.com/ruffymk3/notory_mcp -> Reiter **Settings**.
2. Links im Menu: **Secrets and variables** -> **Actions**.
3. Reiter **Secrets** (nicht "Variables") -> Button **New repository secret**.
4. **Name:** exakt `NPM_TOKEN` (Gross-/Kleinschreibung beachten - der Workflow
   `.github/workflows/publish.yml` liest genau diesen Namen ueber
   `secrets.NPM_TOKEN`).
5. **Secret:** den in Schritt 2 kopierten npm-Token einfuegen.
6. **Add secret** klicken.

## 4. Erstveroeffentlichung ueber ein GitHub-Release ausloesen

Der Workflow `publish.yml` laeuft automatisch, sobald ein GitHub-Release
veroeffentlicht wird (`on: release: types: [published]`). Er fuehrt dann
`npm ci`, `npm run build` und `npm publish --provenance --access public` aus.

1. Im Repo https://github.com/ruffymk3/notory_mcp auf den Reiter **Releases**
   (rechte Seitenleiste oder https://github.com/ruffymk3/notory_mcp/releases/new).
2. **Choose a tag** -> neuen Tag eingeben, passend zur Version in `package.json`
   (aktuell `0.1.0`), also z. B. `v0.1.0` -> "Create new tag on publish" bestaetigen.
3. **Target:** `main` (Standard).
4. **Release title:** z. B. `v0.1.0`.
5. Beschreibung optional (z. B. "Erste oeffentliche Veroeffentlichung").
6. **This is a pre-release** NICHT ankreuzen (ausser bewusst gewuenscht).
7. Button **Publish release** klicken.
8. Danach im Reiter **Actions** des Repos den Lauf des Workflows **publish**
   beobachten. Bei Erfolg ist das Paket auf
   https://www.npmjs.com/package/@notory/mcp sichtbar und laesst sich mit
   `npx -y @notory/mcp` starten.

## 5. Danach pruefen

- https://www.npmjs.com/package/@notory/mcp oeffnen: Version, README und
  MIT-Lizenz sollten korrekt angezeigt werden.
- In einem leeren Ordner testweise `npx -y @notory/mcp` ausfuehren (mit den zwei
  Umgebungsvariablen `NOTORY_BASE_URL`/`NOTORY_API_TOKEN`), um den echten
  npx-Weg einmal zu verifizieren.

## Fuer spaetere Versionen

Bei jedem weiteren Release:

1. Version in `package.json` erhoehen (z. B. `0.1.1` fuer einen Bugfix,
   `0.2.0` fuer neue Funktionen) und committen.
2. Ein neues GitHub-Release mit passendem Tag erstellen (Schritt 4 oben) -
   der Workflow uebernimmt Build und Publish automatisch.

Das npm-Automation-Token braeuchtet ihr nur erneut anlegen, wenn es ablaeuft
oder widerrufen wird (Schritt 2/3 wiederholen, `NPM_TOKEN`-Secret ueberschreiben).
