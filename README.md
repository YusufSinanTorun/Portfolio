# Ausstellung mit Git-Versionierung

Diese Dateien ergänzen dein bestehendes Portfolio. Die ZIP enthält bewusst **keine** Originalbilder und keine Zugangsdaten. Kopiere ihren Inhalt in `C:\Users\yosuf\Downloads\Portfolio`; `pages/ausstellung.html` wird dabei ersetzt, die übrigen Dateien werden ergänzt. Bewahre deine vorhandenen `gfx/`-Bilder, anderen Seiten und deine `.git`-Historie.

## Was die Seite kann

- Die Ausstellung zeigt deine vier bisherigen Zeichnungen sofort; zusätzliche Sammlungen und Bilder werden aus `data/exhibition.json` geladen.
- Unten neben E-Mail und LinkedIn steht „Admin“. Nach Eingabe des Passworts kannst du eine neue Sammlung mit Titel und Beschreibung anlegen oder ein Bild zu einer bestehenden Sammlung hinzufügen. Jedes Bild hat einen Titel, eine Bildunterschrift und eine Beschreibung für Screenreader.
- Der Server prüft das Passwort und erstellt mit der GitHub API **einen** Git-Commit mit dem neuen Bild und der aktualisierten JSON-Datei. Cloudflare Pages veröffentlicht den neuen Commit anschließend über seine Git-Anbindung.
- Im Browsercode steht kein Passwort und kein GitHub-Token. Der Login verwendet ein signiertes Cookie mit `HttpOnly`, `SameSite=Strict`, `Secure` und einer Stunde Gültigkeit.

## Zuerst lokal prüfen

```powershell
cd C:\Users\yosuf\Downloads\Portfolio
npm test
npm run build
```

Der Build legt `dist/` an. Zum Test der öffentlichen Ausstellung ohne Admin-Funktion kannst du `dist/` mit einem lokalen Webserver ausliefern; das direkte Öffnen über `file://` zeigt weiterhin die vier im HTML enthaltenen Zeichnungen. Der Login funktioniert erst, wenn Pages Functions und die Secrets eingerichtet sind.

Für die lokale Prüfung der Admin-Funktion kannst du [Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/pages/) mit `npx wrangler pages dev dist` verwenden. Erstelle dafür **nur auf deinem Rechner** eine nicht versionierte `.dev.vars` im Projektordner:

```text
ADMIN_PASSWORD_HASH=<SHA-256-Wert>
ADMIN_SESSION_SECRET=<Zufallswert>
GITHUB_REPO=<GitHub-Nutzername>/<Repository>
GITHUB_BRANCH=main
GITHUB_TOKEN=<Fine-grained Token>
```

`npm run admin:secrets` fragt verdeckt nach einem langen Passwort und erzeugt die ersten beiden Werte. Speichere das Passwort in deinem Passwortmanager; aus dem Hash lässt es sich nicht zurückholen. **Die `.dev.vars` niemals committen.** Für echte Uploadtests muss das GitHub-Repository bereits existieren: der Upload erzeugt wirklich einen Commit.

## GitHub und Cloudflare Pages einrichten

1. Erstelle auf GitHub ein Repository für dieses Portfolio. Im lokalen Portfolio-Ordner: `git remote -v` prüfen. Wenn noch kein Remote vorhanden ist, `git remote add origin https://github.com/DEIN-NAME/DEIN-REPO.git` ausführen. Danach deine Änderungen bewusst mit `git add` aufnehmen, committen und `git push -u origin main` ausführen. Achtung: Der bisherige lokale Stand enthält eigene Bilder und Kontaktdaten. Prüfe vor dem Push, ob das Repository öffentlich sein soll.
2. Erstelle in Cloudflare **Workers & Pages → Create → Pages → Connect to Git** ein Pages-Projekt aus diesem GitHub-Repository. Build-Befehl: `npm run build`; Ausgabeverzeichnis: `dist`; Produktionsbranch: `main`. `/functions` bleibt im Repository-Stamm, außerhalb von `dist`.
3. Erzeuge über `npm run admin:secrets` dein Passwort-Hash und Session-Secret. Lege in den Cloudflare-Projekteinstellungen `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `GITHUB_REPO`, `GITHUB_BRANCH=main` und `GITHUB_TOKEN` als geschützte Umgebungsvariablen für die **Production**-Functions an. Variablen nicht in den Quellcode, die Git-Historie oder einen Build-Konfigurationswert schreiben.
4. Erstelle bei GitHub einen **Fine-grained personal access token**, der nur für dieses Repository gilt und `Contents: Read and write` erlaubt. Trage ihn als `GITHUB_TOKEN` bei Cloudflare ein. Bei Ablauf des Tokens einen neuen eintragen. Danach einen neuen Cloudflare-Deploy ausführen, damit die Functions die Variablen verwenden.
5. Öffne die veröffentlichte Ausstellung, scrolle zum Ende, klicke auf „Admin“ und teste einen Upload mit einem PNG/JPEG/WebP unter 2 MB. Prüfe danach auf GitHub, dass Bild und `data/exhibition.json` im selben Commit stehen; nach dem nächsten erfolgreichen Deployment erscheint das Werk öffentlich.

Wenn du später lokal am Portfolio weiterarbeitest, hole zuerst die durch den Admin-Upload entstandenen Git-Commits mit `git pull --rebase` ab. Sonst basiert dein lokaler Stand auf einer älteren Version der Sammlung.

## Grenzen

Der erste Upload kann erst getestet werden, wenn GitHub-Repository, Pages-Projekt und die fünf Variablen existieren. Der Server akzeptiert ein Bild pro Git-Commit und maximal 2 MB pro Bild. Der Admin-Bereich erlaubt Hinzufügen; Bearbeiten und Löschen können als eigener Schritt ergänzt werden. Ein langes, zufälliges Passwort ist nötig, da diese erste Version keine zentral gespeicherte Anmelde-Sperre nach Fehlversuchen enthält.
