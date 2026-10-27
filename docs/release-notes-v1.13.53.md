# ECAD Forge 1.13.53

Änderungen seit 1.13.52:

- Die Serverstatistik erfasst zusätzliche grobe Angaben aus normalen HTTP-Anfragen: Browserfamilie, Hauptversionsgruppen, Betriebssystem, Geräteklasse, Sprache, Verweiskategorie, deklarierte Bots und Transportprotokoll. Hinzu kommen Größen- und Zeitklassen der HTML-Auslieferung. Ein Land wird nur übernommen, wenn das Hosting es bereitstellt.
- Die Daten werden direkt auf dem PHP-Server zu getrennten Tagesstatistiken zusammengefasst. Es werden keine einzelnen Abrufe, Roh-IP-Adressen, vollständigen Browserkennungen, URLs oder Besucherkennungen gespeichert oder weitergeleitet. Kleine Kategorien bleiben bei der Übertragung ausgespart; Berichte werden höchstens stündlich gebündelt.
- DNT/GPC-Widerspruchssignale begrenzen die Erfassung auf den einfachen Aufrufzähler. Detailliertes Geräte-Fingerprinting bleibt zustimmungspflichtig und wird nicht mit den Serverstatistiken verknüpft.
- Das Analytics-Dashboard zeigt Kategorien und Abdeckung separat und bietet einen JSON-Export. Datenschutzerklärung und Dialog erklären Umfang und Widerspruchsmöglichkeiten.

Validierung: 1070 App-Tests bestanden, 1 übersprungen; `check:legal`, `check:structured-data`, `build:static` erfolgreich. Analytics 1.3.14: 74 PHP- und 81 JavaScript-Tests sowie PHP-Syntaxprüfung bestanden. Apache/PHP-Routen und Zugriffsschutz geprüft; Dialog, Sprachwechsel und Statistikkomponente mit Testdaten auf Desktop/Mobilansicht geprüft. Die Kategorien sind nicht verifizierte Geräteeigenschaften. Berichte können verzögert oder unvollständig sein; Ablaufbereinigung wird durch weitere Aktivität ausgelöst.

Abhängigkeiten unverändert; keine Zweige zusammengeführt. `user-abo` bleibt getrennt.
