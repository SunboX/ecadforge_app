# ECAD Forge 1.13.52

Änderungen seit 1.13.51:

- Seitenaufrufe des Viewers werden unabhängig von der Analyse-Wahl sparsam auf dem Server gezählt. Gespeichert werden ausschließlich App, UTC-Tag und Anzahl; ohne Besucherkennungen, Geräteinformationen oder Verknüpfung mit einzelnen Personen.
- Detaillierte Nutzungsanalyse und Geräte-Fingerprinting bleiben freiwillig und beginnen erst nach Zustimmung. Ein Widerruf beendet diese zusätzliche Erfassung.
- Analyse-Dialog und Datenschutzerklärung erklären beide Stufen. Das Analytics-Dashboard zeigt die täglichen Serveraufrufe getrennt von detaillierten Seitenaufrufen; Neuladen und Bots zählen mit.

Validierung: `npm test` (1065 bestanden, 1 übersprungen), `check:legal`, `check:structured-data`, `build:static`; lokale Apache/PHP-Routen und Dialog auf Desktop/Mobilansicht geprüft. Analytics 1.3.12: 69 PHP- und 79 JavaScript-Tests sowie PHP-Syntaxprüfung bestanden. Abhängigkeiten unverändert. Keine Zweige zusammengeführt; `user-abo` bleibt getrennt.
