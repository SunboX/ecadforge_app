# ECAD Forge – Spezifikation für Nutzerwachstum & Aktivierung

**App:** https://ecadforge.app/  
**Stand:** 2026-05-25  
**Ziel:** Mehr qualifizierte Nutzer gewinnen, Erstbesucher schneller aktivieren und ECAD Forge klar als privaten, lokalen Browser-Viewer für Altium- und KiCad-Designs positionieren.

---

## 1. Produktpositionierung

### Kernbotschaft

> **Open Altium and KiCad designs locally in your browser.**  
> View schematics, PCB layouts, 3D boards, BOMs and diagnostics from native Altium and KiCad files — without uploading your design.

### Deutsche interne Kurzfassung

ECAD Forge soll als **lokaler, privater Browser-Viewer für ECAD-Dateien** verstanden werden. Der wichtigste Unterschied zu klassischen Online-Viewern ist nicht nur „online“, sondern:

- keine Installation
- kein Account
- kein Server-Upload
- lokale Verarbeitung im Browser
- Unterstützung nativer Altium- und KiCad-Dateien
- geeignet für schnelle Reviews, Sichtprüfungen, BOM-Kontrolle und Projektanalyse

### Primäre Zielgruppen

1. Hardware-Entwickler, die schnell fremde oder eigene Projekte prüfen möchten.
2. Open-Hardware-Maintainer, die KiCad-Projekte im Browser teilen möchten.
3. Kleine Hardware-Teams, die keine unfertigen Designs auf fremde Server hochladen wollen.
4. Freelancer und Consultants, die Altium-/KiCad-Dateien von Kunden prüfen.
5. Maker, Studenten und Entwickler, die KiCad-Projekte ohne lokale Toolchain ansehen möchten.

---

## 2. Hauptprobleme der aktuellen Aktivierung

### Problem 1: Nutzer müssen sofort eigene Dateien haben

Viele Erstbesucher haben beim ersten Besuch keine passende `.PcbDoc`, `.SchDoc`, `.kicad_pcb` oder Projektdatei griffbereit. Dadurch wird das Tool nicht erlebt.

### Problem 2: Zu wenig sichtbare Differenzierung

Der wichtigste Vorteil „lokal im Browser / kein Upload“ muss prominenter und wiederholt kommuniziert werden.

### Problem 3: Wenig indexierbarer Kontext

Die App-Shell allein reicht für Suchmaschinen, Social Shares und neue Besucher nicht aus. Es fehlen erklärende Landingpages für konkrete Suchintentionen.

---

## 3. Zielbild der Startseite

### Above-the-fold Layout

**Headline**

> Open Altium and KiCad designs locally in your browser

**Subheadline**

> View schematics, PCB layouts, 3D boards, BOMs and diagnostics from native `.SchDoc`, `.PcbDoc` and KiCad project files — without uploading your design.

**Primäre CTAs**

1. **Try sample Altium project**
2. **Try sample KiCad project**
3. **Open local files**

**Sekundäre Links**

- Supported formats
- How local parsing works
- Privacy & security
- Need clean assembly images? Try PCB Styler

### Trust- und Differenzierungszeile

Direkt unter den CTAs:

> Local browser parsing · No account · No server upload · Built and hosted in Germany

Hinweis: Schreibfehler korrigieren: **“Built and hosted in Germany”** statt **“Build and hostet in Germany”**.

---

## 4. Demo-Projekte

### Ziel

Nutzer sollen ECAD Forge innerhalb von 5–10 Sekunden erleben können, ohne eigene Dateien hochzuladen oder auszuwählen.

### Anforderungen

Es sollen mindestens zwei sofort ladbare Demo-Projekte geben:

1. **Sample KiCad project**
2. **Sample Altium project**

Optional später:

3. **Small 2-layer board**
4. **Complex 4-layer board**
5. **Project with BOM/diagnostics examples**

### UX-Anforderungen

- Demo-Buttons müssen auf der Startseite sichtbar sein.
- Demo-Ladevorgang soll sich wie echtes Öffnen eines Projekts anfühlen.
- Nach dem Öffnen sollte eine kurze Tour oder ein Hinweis erscheinen:
  > This sample project is parsed locally in your browser. Try switching between schematic, PCB, 3D, BOM and diagnostics.
- Nutzer sollen Demo-Projekte wieder verlassen und eigene Dateien öffnen können.
- Demo-Projekte sollten auch über direkte URLs erreichbar sein.

### Beispiel-URLs

```text
https://ecadforge.app/demo/kicad
https://ecadforge.app/demo/altium
```

oder query-basiert:

```text
https://ecadforge.app/?demo=kicad
https://ecadforge.app/?demo=altium
```

### Akzeptanzkriterien

- Ein neuer Besucher kann ohne lokale Datei ein Demo-Projekt öffnen.
- Die Demo öffnet sich ohne Account, Download oder Server-Upload.
- Die Demo zeigt mindestens PCB-Ansicht und eine weitere Ansicht, zum Beispiel BOM oder Diagnostics.
- Der Nutzer erkennt sichtbar, dass ECAD Forge Altium und KiCad unterstützt.

---

## 5. „Open from GitHub URL“-Flow

### Ziel

ECAD Forge soll teilbare Viewer-Links für Open-Hardware-Projekte ermöglichen.

### Nutzen

- Nutzer können Links zu Projekten teilen.
- Open-Hardware-Repos können direkt auf ECAD Forge verlinken.
- Community-Posts werden einfacher.
- Das Tool wird von einem lokalen File-Viewer zu einem teilbaren Review-Tool.

### Funktionsidee

Nutzer können eine KiCad- oder Altium-Datei über eine GitHub-URL öffnen.

### Beispiel

```text
https://ecadforge.app/?url=https://raw.githubusercontent.com/org/repo/main/hardware/main.kicad_pcb
```

Optional komfortabler:

```text
https://ecadforge.app/?github=owner/repo/path/to/project.kicad_pro
```

### Anforderungen

- Unterstützung für `raw.githubusercontent.com`-URLs.
- Optional Unterstützung für normale GitHub-URLs, die intern in Raw-URLs umgewandelt werden.
- Fehleranzeige bei nicht unterstützten Dateien.
- Klare CORS-/Fetch-Fehlerbehandlung.
- Keine dauerhafte Speicherung fremder Dateien.
- Hinweis, dass externe Dateien über die angegebene URL geladen werden, aber weiterhin lokal im Browser verarbeitet werden.

### Akzeptanzkriterien

- Ein Nutzer kann eine unterstützte GitHub-Raw-Datei per URL öffnen.
- Der Link ist teilbar und reproduzierbar.
- Fehlerfälle werden verständlich angezeigt.
- Lokale Verarbeitung bleibt klar kommuniziert.

---

## 6. Landingpages für SEO und Nutzerverständnis

### Ziel

Mehr organischen Traffic über konkrete Suchintentionen gewinnen.

### Grundstruktur jeder Landingpage

Jede Landingpage sollte enthalten:

1. H1 mit konkretem Suchbegriff
2. Kurze Erklärung des Problems
3. Screenshot oder Demo-GIF
4. Primärer CTA
5. Unterstützte Formate
6. Datenschutz-/No-Upload-Hinweis
7. 3–5 konkrete Use Cases
8. FAQ
9. Interner Link zur Haupt-App
10. Interner Link zu PCB Styler, falls relevant

### Vorgeschlagene Landingpages

#### `/altium-pcbdoc-viewer`

**H1**

> Altium PcbDoc Viewer in Your Browser

**Zielnutzer**

Nutzer mit `.PcbDoc`-Dateien, die kein Altium installiert haben oder schnell eine Board-Datei prüfen wollen.

**CTA**

> Open local PcbDoc file

#### `/altium-schdoc-viewer`

**H1**

> Altium SchDoc Viewer in Your Browser

**Zielnutzer**

Nutzer, die Altium-Schaltpläne schnell ansehen möchten.

#### `/kicad-viewer-online`

**H1**

> KiCad Viewer Online — No Upload Required

**Zielnutzer**

Maker, Studenten, Open-Hardware-Entwickler.

#### `/kicad-project-viewer`

**H1**

> View KiCad Projects in Your Browser

**Zielnutzer**

Nutzer mit ganzen KiCad-Projekten, nicht nur Einzeldateien.

#### `/ecad-viewer-no-upload`

**H1**

> Private ECAD Viewer with Local Browser Parsing

**Zielnutzer**

Professionelle Hardware-Teams mit Datenschutzbedenken.

#### `/altium-kicad-browser-viewer`

**H1**

> Altium and KiCad Browser Viewer

**Zielnutzer**

Teams mit gemischten Toolchains.

#### `/pcb-3d-viewer-browser`

**H1**

> PCB 3D Viewer in the Browser

**Zielnutzer**

Nutzer, die schnell eine räumliche Prüfung machen möchten.

#### `/bom-viewer-kicad-altium`

**H1**

> BOM Viewer for KiCad and Altium Projects

**Zielnutzer**

Nutzer, die Stücklisten prüfen möchten.

### Akzeptanzkriterien

- Jede Seite hat eindeutigen Title und Meta Description.
- Jede Seite hat mindestens einen Screenshot oder Demo-Link.
- Jede Seite verlinkt zur App.
- Jede Seite erklärt „local browser parsing / no upload“.
- Jede Seite ist in der Sitemap enthalten.
- Jede Seite hat eine kanonische URL.

---

## 7. SEO-Metadaten und strukturierte Daten

### Globaler Title-Vorschlag

```text
ECAD Forge – Altium & KiCad Viewer in Your Browser
```

### Globale Meta Description

```text
Open Altium and KiCad designs locally in your browser. View schematics, PCB layouts, 3D boards, BOMs and diagnostics without uploading your files.
```

### OpenGraph

```html
<meta property="og:title" content="ECAD Forge – Altium & KiCad Viewer in Your Browser">
<meta property="og:description" content="View native Altium and KiCad designs locally in your browser — no upload, no account, no installation.">
<meta property="og:image" content="https://ecadforge.app/og/ecadforge-viewer.png">
<meta property="og:type" content="website">
```

### Strukturierte Daten

`SoftwareApplication` JSON-LD einbauen.

Beispiel:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ECAD Forge",
  "applicationCategory": "DesignApplication",
  "operatingSystem": "Any",
  "description": "Open Altium and KiCad designs locally in your browser. View schematics, PCB layouts, 3D boards, BOMs and diagnostics without uploading your files.",
  "url": "https://ecadforge.app/",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "EUR"
  }
}
```

### Sitemap

Sitemap muss enthalten:

```text
/
 /altium-pcbdoc-viewer
 /altium-schdoc-viewer
 /kicad-viewer-online
 /kicad-project-viewer
 /ecad-viewer-no-upload
 /altium-kicad-browser-viewer
 /pcb-3d-viewer-browser
 /bom-viewer-kicad-altium
```

---

## 8. App-UX-Anpassungen

### Empty State

Wenn noch keine Datei geöffnet ist:

**Headline**

> Open a design file or start with a sample project

**Text**

> ECAD Forge parses supported Altium and KiCad files locally in your browser. Your design does not need to be uploaded to a server.

**Buttons**

- Try KiCad sample
- Try Altium sample
- Open local files

### File-Drop-Bereich

Ergänze direkt im Drop-Bereich:

> Drop `.PcbDoc`, `.SchDoc`, `.kicad_pcb` or KiCad project files here. Files are processed locally in your browser.

### Fehlerzustände

Fehler sollten nicht nur technisch sein, sondern Nutzer zum nächsten Schritt führen.

Beispiel:

> This file type is not supported yet. ECAD Forge currently supports selected Altium and KiCad design files.  
> Try a sample project or open a supported board/schematic file.

### Erfolgszustand

Nach erfolgreichem Laden:

> Design loaded locally. Use the tabs to inspect PCB, schematic, 3D view, BOM and diagnostics.

---

## 9. Crosslinking mit PCB Styler

### Ziel

Beide Apps sollen sich gegenseitig Nutzer zuführen.

### In ECAD Forge anzeigen

An geeigneten Stellen:

> Need clean assembly images for documentation? Open this board in PCB Styler.

Mögliche Orte:

- Nach erfolgreichem Laden eines Boards
- Im Export-/Share-Menü
- In der PCB-Ansicht
- Auf SEO-Landingpages

### Link-Varianten

Wenn Datei lokal geöffnet wurde:

> Export or reopen in PCB Styler

Wenn GitHub-URL bekannt ist:

```text
https://pcb-styler.app/?url=<encoded-board-url>
```

### Akzeptanzkriterien

- ECAD Forge verlinkt an mindestens zwei sinnvollen Stellen auf PCB Styler.
- Der Link ist kontextbezogen und nicht werblich.
- Nutzer verstehen, dass PCB Styler für schöne Assembly- und Doku-Bilder gedacht ist.

---

## 10. Analytics und Ereignisse

### Ziel

Verstehen, wo Nutzer abbrechen und welche Features zu Aktivierung führen.

### Datenschutz

Nur privacy-friendly Analytics verwenden. Keine Dateinamen, keine Dateiinhalte, keine personenbezogenen Daten erfassen.

### Events

```text
landing_view
sample_kicad_clicked
sample_altium_clicked
sample_loaded_success
sample_loaded_error
local_file_open_clicked
local_file_loaded_success
local_file_loaded_error
github_url_open_attempted
github_url_loaded_success
github_url_loaded_error
view_schematic_opened
view_pcb_opened
view_3d_opened
view_bom_opened
view_diagnostics_opened
crosslink_pcb_styler_clicked
```

### Wichtige Funnels

1. Startseite → Demo geklickt → Demo erfolgreich geladen
2. Startseite → lokale Datei geöffnet → Datei erfolgreich geladen
3. GitHub-Link → Projekt erfolgreich geladen
4. Datei geladen → mindestens zwei Ansichten geöffnet
5. Datei geladen → PCB Styler Link geklickt

### Akzeptanzkriterien

- Events enthalten keine Dateinamen.
- Erfolgs- und Fehlerfälle werden getrennt gemessen.
- Aktivierung kann als „Projekt geladen + mindestens eine Ansicht geöffnet“ gemessen werden.

---

## 11. Community- und Distribution-Anforderungen

### KiCad-Ökosystem

Vorbereiten einer kurzen Beschreibung für Tool-Listen:

```text
ECAD Forge is a private browser-based viewer for native Altium and KiCad design files. It opens schematics, PCB layouts, 3D board views, BOMs and diagnostics locally in the browser without uploading design files.
```

### GitHub README Snippet

```markdown
## View this hardware project

You can inspect the board and schematic with ECAD Forge:

[Open in ECAD Forge](https://ecadforge.app/?github=owner/repo/path/to/project.kicad_pro)
```

### Community-Post-Text

```text
I built a local browser-based ECAD viewer for native Altium and KiCad files. It can show schematics, PCB layouts, 3D board views, BOMs and diagnostics without uploading design files to a server.

I’m looking for feedback from KiCad/Altium users: which file formats or board cases should I test next?
```

---

## 12. Priorisierte Roadmap

### P0 – Sofort umsetzen

1. Startseiten-Copy anpassen.
2. „No upload / local browser parsing“ prominent machen.
3. Demo-Projekte einbauen.
4. Schreibfehler „Built and hosted in Germany“ korrigieren.
5. OpenGraph-Bild ergänzen.
6. Sitemap und Search Console prüfen.

### P1 – Hoher Wachstumseffekt

1. SEO-Landingpages erstellen.
2. `SoftwareApplication` JSON-LD einbauen.
3. GitHub-URL-Flow implementieren.
4. Crosslink zu PCB Styler einbauen.
5. Aktivierungs-Analytics ergänzen.

### P2 – Community und Skalierung

1. KiCad-/Open-Hardware-Toollisten anschreiben.
2. README-Badges und Link-Snippets bereitstellen.
3. Beispielprojekte als öffentliche Showcases veröffentlichen.
4. Blogpost: „Viewing Altium and KiCad files locally in the browser“.

---

## 13. Messbare Ziele

### Nach 30 Tagen

- Demo-Click-Rate auf Startseite: mindestens 20 %
- Erfolgreich geladene Demo-Projekte: mindestens 70 % der Demo-Klicks
- Mindestens 5 neue organische Landingpages indexiert
- Mindestens 3 externe Erwähnungen oder Backlinks
- Mindestens 1 Community-Post mit qualifiziertem Feedback

### Nach 90 Tagen

- 2–3x mehr aktivierte Sessions gegenüber Ausgangswert
- Mindestens 10 indexierte Suchseiten
- Mindestens 10 Open-Hardware-Repos oder Community-Links, die auf ECAD Forge verweisen
- Erkennbare Nutzung des GitHub-URL-Flows

---

## 14. Definition von Aktivierung

Ein Nutzer gilt als aktiviert, wenn mindestens eines dieser Ziele erfüllt ist:

1. Demo-Projekt erfolgreich geöffnet und mindestens zwei Ansichten genutzt.
2. Lokale Datei erfolgreich geöffnet.
3. GitHub-URL erfolgreich geöffnet.
4. BOM oder Diagnostics geöffnet.
5. Link zu PCB Styler nach geöffnetem Board geklickt.

---

## 15. Offene technische Fragen

- Welche Altium-Dateiformate werden aktuell stabil unterstützt?
- Welche KiCad-Versionen sind vollständig kompatibel?
- Können Demo-Projekte aus lizenzrechtlicher Sicht öffentlich bereitgestellt werden?
- Wird GitHub-URL-Loading durch CORS oder Dateigrößen begrenzt?
- Welche Analytics-Lösung ist datenschutzkonform und passt zur Hosting-Architektur?
- Soll die App mehrsprachige Landingpages bekommen oder zunächst Englisch bleiben?
