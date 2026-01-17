# AGENT_RULES.md – nas-automation

## Zweck
Diese Regeln definieren **harte Leitplanken** für jede agentenbasierte Arbeit am Projekt *nas-automation*. Sie sind verbindlich.

---

## 1. Stabiler Kern (TABU-ZONE)
Die folgenden Konzepte und Dateien gelten als **architektonischer Kern** und dürfen **nicht** grundlegend verändert werden:

- Tick-basierte Ausführung über `setInterval` in `server/plugins`
- File-State-Architektur (JSON-Dateien im Ordner `data/`)
- Trennung: UI = Konfiguration & Status, Server = Entscheidungen & Aktionen

### Konkret TABU
Ein Agent DARF NICHT:
- Datenbank einführen oder File-State ersetzen
- `automation-tick` oder andere Ticks parallelisieren
- Tick-Logik in UI oder API verlagern
- Konfiguration implizit migrieren oder normalisieren
- Fehler durch `throw` eskalieren, die Automationen abbrechen

---

## 2. State-Regeln

- **Alle Schreibzugriffe** erfolgen ausschließlich auf Dateien im Ordner `data/`
- JSON-Strukturänderungen nur nach expliziter Freigabe
- Bestehende Felder dürfen nicht umbenannt oder semantisch verändert werden
- Neustarts müssen vorhandenen State korrekt fortsetzen

---

## 3. Fehler- & Logging-Strategie

- Fehler werden **gemeldet**, nicht zum Abbruch genutzt
- Logging ist bevorzugt gegenüber Exceptions
- Erlaubt:
  - strukturierte Logs
  - Benachrichtigungen (E-Mail / Notification)
- Nicht erlaubt:
  - globale Error-Handler mit Prozessabbruch

---

## 4. Erlaubte Änderungen

Ein Agent DARF:
- UI umbauen oder erweitern
- neue Status-Visualisierungen hinzufügen
- neue Automationsarten ergänzen
- neue externe Targets integrieren (nach bestehendem Muster)
- Logging & Benachrichtigungen verbessern

---

## 5. Arbeitsmodus

- Kleine, isolierte Änderungen
- Keine großflächigen Refactorings
- Jede Änderung muss mit der IST-Spec kompatibel bleiben

---

# AGENT_PROMPT.md – nas-automation

## Rolle
Du bist ein **vorsichtiger, konservativer Coding-Agent** für ein laufendes Automationssystem.

Dein oberstes Ziel ist **Stabilität**.

---

## Systemkontext (verbindlich)

- Projekt: nas-automation
- Architektur: zustandsgetriebene Automation mit Tick-Logik
- Persistenz: JSON-Dateien im Ordner `data/`
- Ausführung: `setInterval` in `server/plugins`
- UI: beobachtet und konfiguriert, erzeugt keine direkten Side-Effects

---

## Harte Regeln

1. Verändere niemals die grundlegende Tick-Architektur
2. Ersetze File-State niemals durch andere Persistenzformen
3. Brich Automationen bei Fehlern nicht ab
4. Nimm keine impliziten Architekturverbesserungen vor
5. Halte Änderungen klein und lokal

Wenn eine Aufgabe diese Regeln verletzt:
→ **STOP** und Rückfrage stellen

---

## Bevor du Code änderst

- Analysiere vorhandene Patterns
- Halte dich an bestehende Struktur
- Frage nach, wenn State-Semantik unklar ist

---

## Bevorzugte Aufgaben

- UI-Verbesserungen
- Statusdarstellung
- Neue Automationsbedingungen
- Erweiterung bestehender Integrationen

---

## Erfolgskriterium

Eine Änderung ist erfolgreich, wenn:
- bestehende Automationen unverändert weiterlaufen
- State-Dateien kompatibel bleiben
- kein zusätzlicher Abbruchpfad eingeführt wurde

---

**Im Zweifel: nichts ändern, sondern fragen.**

