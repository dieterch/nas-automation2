# SPEC-IST – nas-automation

## 1. Zweck des Systems
nas-automation ist eine zustandsgetriebene Automations‑Webapplikation auf Basis von Nuxt (Nitro), deren primärer Zweck die **Orchestrierung und Überwachung von NAS‑, Backup‑ und Plex‑bezogenen Abläufen** ist.

Das System ist **kein klassisches CRUD‑System**, sondern eine **Automation Engine mit UI**, bei der:
- das UI Zustand und Konfiguration verändert
- eine serverseitige Tick‑Logik Entscheidungen trifft
- Aktionen indirekt über Zustandsänderungen ausgelöst werden

---

## 2. Architekturüberblick

### 2.1 Laufzeitmodell

- Single‑Instance‑Anwendung
- Server‑Side Execution über Nitro
- **Tick-Ausführung per `setInterval` in `server/plugins`**
- Separate Intervalle für:
  - Automation
  - Plex Schedules
  - Proxmox Backup Window Updates

```
Browser (UI)
   ↓ (pollt Status)
JSON-Dateien (data/)
   ↓ (periodische Ticks)
server/plugins/* (setInterval)
   ↓
Externe Systeme (Plex, NAS, Proxmox)
```

UI-Seiten pollen teilweise aktiv, lesen jedoch **ausschließlich Statusinformationen**.

---

## 3. Zentrales Architekturprinzip (kritisch)

### File‑State‑Driven Design

Der **gesamte Systemzustand** wird über Dateien im Ordner `data/` abgebildet.

Diese Dateien sind:
- Persistenz
- Konfiguration
- Kommunikationsschnittstelle zwischen UI und Automation

Es existiert **keine Datenbank**.

---

## 4. State- & Konfigurationsdateien

### 4.1 `data/configuration.json`
**Source of Truth für Systemverhalten**

Enthält:
- definierte Automationen
- Parameter, Schwellwerte, Zeitfenster
- Zielsysteme

Diese Datei:
- wird vom UI verändert
- wird vom Automation‑Tick gelesen
- darf nicht implizit migriert oder normalisiert werden

---

### 4.2 `data/automation-state.json`
**Laufzeit‑ und Fortschrittszustand**

Enthält:
- Status laufender oder geplanter Automationen
- Marker für bereits ausgeführte Schritte

Wichtig:
- Neustart des Systems setzt diesen Zustand **nicht zurück**
- Idempotenz basiert auf diesem State

---

### 4.3 `data/plex-scheduled.json`
**Plex‑spezifischer Scheduling‑State**

- Geplante / erkannte Plex‑Jobs
- Bindeglied zwischen Plex‑Events und Automation

---

## 5. Zentrale Domänen

### 5.1 Automation
- Regelwerk, das entscheidet **ob** und **wann** etwas passiert
- Besteht aus Bedingungen + Aktionen

### 5.2 Tick / Orchestrierung
- Zentrale Logik in `automation-tick.ts`
- Wird regelmäßig ausgeführt
- Trifft Entscheidungen auf Basis des aktuellen States

### 5.3 SystemStatus
- Abgeleiteter Zustand (nicht primär persistent)
- Wird im UI visualisiert

### 5.4 Plex Integration
- Abfrage von Aufnahmen / Status
- Ableitung von Automationsentscheidungen

### 5.5 NAS / Backup
- Proxmox‑Backup‑bezogene Abläufe
- Synchronisations‑ und Zustandslogik

---

## 6. Implizite Regeln (explizit gemacht)

Diese Regeln gelten systemweit:

1. Alle Automationslogik läuft **ausschließlich** in `server/plugins` über `setInterval`
2. Es existieren mehrere spezialisierte Ticks (Automation, Plex, Backup)
3. UI erzeugt **keine Side‑Effects**, sondern liest Status oder verändert Konfiguration
4. **Schreibzugriffe erfolgen nur auf Dateien im Ordner `data/`**
5. Fehler sollen **gemeldet**, aber **nicht zum Abbruch** von Automationen führen
6. System ist Single‑User by Design, mit optionaler späterer Einschränkung einzelner UI‑Funktionen für Familienmitglieder
7. Neustarts setzen keinen Zustand zurück

---

## 7. Nicht-Ziele des Systems

Das System ist explizit **nicht**:
- ein generisches Workflow‑Tool
- ein Multi‑Tenant‑ oder Mandanten‑System
- ein hochverfügbares oder verteiltes System
- ein CRUD‑Backend mit relationalem Modell
- ein System mit harter Fehlerabbruch‑Semantik

---

## 8. Agent-KI Boundary (sehr wichtig)

### Ein Agent DARF:
- UI erweitern oder umbauen
- neue Automationsarten hinzufügen
- neue externe Targets integrieren

### Ein Agent DARF NICHT:
- State-Dateien durch DB ersetzen
- automation-tick zerlegen oder parallelisieren
- Konfiguration implizit migrieren
- State-Handling „optimieren“, ohne explizite Vorgabe

---

## 9. Zusammenfassung

nas-automation ist eine **zustandsgetriebene Automations-Engine mit Web‑UI**, deren Stabilität maßgeblich von:
- explizitem State‑Handling
- deterministischem Tick‑Verhalten
- klaren Agent‑Grenzen

abhängt.

Diese Ist‑Spec ist die verbindliche Grundlage für jede weitere Automatisierung oder Agent‑basierte Entwicklung.

