# nas-automation2

`nas-automation2` ist eine zustandsgetriebene Nuxt/Nitro-Anwendung zur Orchestrierung von NAS-, Plex- und Backup-Abläufen.

Der Kern des Systems ist keine Datenbank und kein klassisches CRUD-Backend, sondern eine serverseitige Tick-Logik mit dateibasierter Persistenz in `data/`.

## Architektur

- UI-Seiten lesen Status und ändern Konfiguration.
- Periodische Ticks in `server/plugins/` stoßen Automationslogik an.
- Laufzeit- und Konfigurationszustand liegt in JSON-Dateien unter `data/`.
- Externe Systeme werden serverseitig angesprochen.

Die verbindliche Ist-Beschreibung steht in [spec_ist_nas_automation.md](/home/developer/projects/nas-automation2/spec_ist_nas_automation.md).

## Wichtige Verzeichnisse

- `pages/`: UI
- `server/api/`: API-Endpunkte für Status, Konfiguration und manuelle Aktionen
- `server/plugins/`: periodische Ticks
- `server/utils/`: Automations-, Geräte- und Persistenzlogik
- `data/`: Persistenz für Konfiguration, State und Caches
- `docker/`: Dockerfile und Compose-Setup

## Laufzeitdaten

Für einen sinnvollen Betrieb werden lokale Laufzeitdaten erwartet:

- `.env`
- `data/configuration.json`
- `data/automation-state.json`
- weitere Dateien unter `data/`, die im Betrieb gelesen oder erzeugt werden

Diese Dateien gehören nicht ins Git.

Eine Vorlage für Umgebungsvariablen liegt in [.env.example](/home/developer/projects/nas-automation2/.env.example).

## Lokale Entwicklung

Abhängigkeiten installieren:

```bash
npm install
```

Entwicklungsserver starten:

```bash
npm run dev
```

Produktionsbuild erzeugen:

```bash
npm run build
```

Produktionsbuild lokal starten:

```bash
npm run preview
```

## Docker

Das Repo enthält ein lauffähiges Docker-Setup unter `docker/`.

Statische Prüfung der Compose-Datei:

```bash
docker compose -f docker/compose.yml config
```

Image bauen:

```bash
docker build -f docker/Dockerfile .
```

Containerstart erfolgt über:

```bash
docker compose -f docker/compose.yml up -d
```

Vor dem Start müssen `.env`, `data/` und `logs/` im Repo vorhanden sein.

Weitere Hinweise stehen in [docker/README.md](/home/developer/projects/nas-automation2/docker/README.md).

## Git und Secrets

Nicht committen:

- echte `.env`-Dateien
- Inhalte aus `data/`
- Logs
- sonstige lokale Betriebsdaten

Die Ignore-Regeln dafür sind bereits im Repo hinterlegt.
