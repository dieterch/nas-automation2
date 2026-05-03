# Status – Plex Offline Index

Stand: 2026-05-03

## Aktueller Funktionsstand

- Plex-Libraries werden live über `GET /api/plex/index/libraries` gelesen.
- Film-Libraries können lokal synchronisiert werden.
- Serien-Libraries können lokal als Shows und Episoden synchronisiert werden.
- Lokale Indexdaten liegen unter `data/plex-index/`.
- Poster werden lokal gespeichert und mit Retry sowie begrenzter Parallelität nachgeladen.
- Sync-Status wird persistent in `data/plex-index/sync-status.json` gehalten.
- Die UI unter `pages/plex-index.vue` funktioniert auch mit rein lokalen Indexdaten.

## Vorhandene APIs

- `GET /api/plex/index/libraries`
- `POST /api/plex/index/sync`
- `GET /api/plex/index/status`
- `GET /api/plex/index/movies`
- `GET /api/plex/index/shows`
- `GET /api/plex/index/episodes`
- `GET /api/plex/index/poster`

## UI-Stand

- Mediathek-Auswahl
- Suchfeld
- Hamburger-Menü für Anzeigeeinstellungen
- Sortierung nach:
  - Aufnahmedatum
  - Produktionsdatum
  - Filmname
- Sortierrichtung getrennt wählbar
- umschaltbare Postergrößen
- kompakter Sync-Icon-Button statt breitem Text-Button
- Statistik mit:
  - Anzahl Filme oder Serien
  - Episodenanzahl bei Serien
  - Laufzeit in Stunden
  - belegter Größe in GB
- Serienansicht mit Shows und ausklappbaren Episoden
- Anzeige von Produktionsjahr und Aufnahmedatum in den Karten

## Wichtige Dateien

- `pages/plex-index.vue`
- `server/utils/plex-index.ts`
- `server/api/plex/index/libraries.get.ts`
- `server/api/plex/index/sync.post.ts`
- `server/api/plex/index/status.get.ts`
- `server/api/plex/index/movies.get.ts`
- `server/api/plex/index/shows.get.ts`
- `server/api/plex/index/episodes.get.ts`
- `server/api/plex/index/poster.get.ts`
- `spec_plex_offline_index.md`

## Docker-Stand

- Das Repo-`compose.yml` ist derzeit für Direktzugriff konfiguriert:
  - Host-Port `4800` auf Container-Port `3000`
- Die Traefik-Konfiguration ist als auskommentierte Vorlage in `docker/compose.yml` enthalten.
- Für Host-Betrieb mit Traefik:
  - Port-Mapping entfernen
  - Traefik-Labels aktivieren
  - externes Netzwerk `traefik_network` verwenden

## Letzte relevante Commits

- `d303210` Use icon button for Plex sync
- `301ebd5` Update Plex offline index documentation
- `63a0b70` Add Plex series index and library sizes
- `4085a2a` Harden Plex poster downloads
- `a947bbb` Add Plex sync status tracking

## Sinnvolle nächste Schritte

- Serien-UI weiter verfeinern, z. B. Staffelgruppierung
- Fehlertransparenz im UI erweitern
- globale Synchronisierung mehrerer Libraries ausbauen
- Filter nach Jahr, Genre oder Posterstatus ergänzen
- bestehende Libraries bei Bedarf neu synchronisieren, um Metadaten vollständig zu aktualisieren
