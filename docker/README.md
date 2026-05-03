# Docker-Setup

Dieses Verzeichnis enthält das containerisierte Repo-Setup für `nas-automation2`.

## Dateien

- `compose.yml`: Compose-Definition für den Betrieb
- `Dockerfile`: Build des Nuxt/Nitro-Containers

## Erwartete Struktur

Die Compose-Datei verwendet den Repo-Root als Build-Kontext und bindet Laufzeitdaten aus dem Projektverzeichnis ein:

- `../data` nach `/app/data`
- `../.env` nach `/app/.env`
- `../logs` nach `/app/logs`

## Voraussetzungen

Vor dem Start sollten diese Pfade im Repo vorhanden sein:

- `.env`
- `data/`
- `logs/`

Zusätzlich erwartet `compose.yml` das externe Docker-Netzwerk `traefik_network`.

## Nützliche Befehle

Compose-Konfiguration prüfen:

```bash
docker compose -f docker/compose.yml config
```

Image bauen:

```bash
docker build -f docker/Dockerfile .
```

Container starten:

```bash
docker compose -f docker/compose.yml up -d
```

Container stoppen:

```bash
docker compose -f docker/compose.yml down
```

## Hinweise

- Laufzeitdaten bleiben außerhalb des Images im Repo-Verzeichnis erhalten.
- `.dockerignore` verhindert, dass lokale Betriebsdaten in den Build-Kontext geraten.
- Änderungen an `data/` beeinflussen direkt das Verhalten der Automation.
