# Docker-Setup

Dieses Verzeichnis enthält das containerisierte Repo-Setup für `nas-automation2`.

## Dateien

- `compose.yml`: Compose-Definition für den Betrieb
- `compose.local.example.yml`: Beispiel für host-spezifische Overrides
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

Das aktuelle `compose.yml` im Repo ist die gemeinsame Basis und ist auf direkten Zugriff per Host-Port ausgelegt:

- `4800:3000`

Für host-spezifische Anpassungen sollte zusätzlich eine lokale, nicht versionierte Datei verwendet werden:

- `docker/compose.local.yml`

Eine Vorlage dafür liegt in:

- `docker/compose.local.example.yml`

## Nützliche Befehle

Compose-Konfiguration prüfen:

```bash
docker compose -f docker/compose.yml config
```

Basis plus lokales Override prüfen:

```bash
docker compose -f docker/compose.yml -f docker/compose.local.yml config
```

Image bauen:

```bash
docker build -f docker/Dockerfile .
```

Container starten:

```bash
docker compose -f docker/compose.yml up -d
```

Mit lokalem Override starten:

```bash
docker compose -f docker/compose.yml -f docker/compose.local.yml up -d
```

Container stoppen:

```bash
docker compose -f docker/compose.yml down
```

## Hinweise

- Laufzeitdaten bleiben außerhalb des Images im Repo-Verzeichnis erhalten.
- `.dockerignore` verhindert, dass lokale Betriebsdaten in den Build-Kontext geraten.
- Änderungen an `data/` beeinflussen direkt das Verhalten der Automation.
- Lokale Host-Anpassungen gehören in `docker/compose.local.yml`, damit `git pull` die laufende Host-Konfiguration nicht stört.
- Für Host-Betrieb hinter Traefik: Vorlage aus `docker/compose.local.example.yml` verwenden.
