# SPEC – Plex Offline Index für nas-automation2

## 1. Ziel

`nas-automation2` soll eine lokale, durchsuchbare Kopie ausgewählter Plex-Mediatheken erzeugen, damit Inhalte auch dann im UI sichtbar bleiben, wenn NAS und Plex offline sind.

Der Startumfang ist bewusst klein:

1. Plex-Mediatheken auflisten
2. ausgewählte Mediatheken lokal synchronisieren
3. Filme mit Poster, Titel und Erscheinungsjahr anzeigen
4. Serien im Datenmodell vorbereiten, aber funktional noch nicht vollständig umsetzen

---

## 2. Projektkontext

Die Erweiterung muss zur bestehenden Architektur passen:

- Nuxt/Nitro-Anwendung
- serverseitige API-Routen unter `server/api`
- dateibasierte Persistenz unter `data/`
- keine Datenbank
- UI liest Status und Indexdaten, erzeugt aber keine direkte Plex-Logik im Browser

Die Erweiterung ist daher **file-state-getrieben** umzusetzen.

---

## 3. Nicht-Ziele

Diese Erweiterung soll vorerst **nicht**:

- Plex vollständig spiegeln
- Transcoding oder Streaming bereitstellen
- Serien- und Episoden-Ansichten vollständig implementieren
- Benutzerverwaltung oder Mehrbenutzerlogik einführen
- bestehende Automationslogik grundlegend umbauen

---

## 4. Konfiguration

Bestehende Konfiguration soll weiterverwendet werden:

- `PLEX_HOST`
- `PLEX_TOKEN`

Neu ergänzt werden kann:

- `PLEX_INDEX_DIR`

Beispiel:

```env
PLEX_HOST=http://192.168.x.x:32400
PLEX_TOKEN=xxxxxxxxxxxxxxxxxxxx
PLEX_INDEX_DIR=/app/data/plex-index
```

Wichtig:

- Im bestehenden Projekt heißt die Variable bereits `PLEX_HOST`, nicht `PLEX_URL`.
- Für Konsistenz soll `PLEX_HOST` beibehalten werden.

Wenn `PLEX_INDEX_DIR` nicht gesetzt ist, soll als Default `data/plex-index` verwendet werden.

---

## 5. Datenablage

Der Offline-Index liegt unterhalb von `data/plex-index/`.

Vorgesehene Struktur:

```text
data/
  plex-index/
    libraries.json
    movies.json
    posters/
      <libraryKey>/
        <ratingKey>.jpg
    shows.json
    episodes.json
```

### 5.1 `libraries.json`

Enthält lokal bekannte Plex-Libraries, z. B.:

- `key`
- `title`
- `type`
- `agent`
- `updatedAt`
- `lastSyncAt`

### 5.2 `movies.json`

Enthält lokal synchronisierte Filme.

Jeder Filmeintrag sollte mindestens enthalten:

- `ratingKey`
- `libraryKey`
- `title`
- `originalTitle`
- `year`
- `summary`
- `contentRating`
- `studio`
- `genres`
- `posterPath`
- `thumbPath`
- `addedAt`
- `updatedAt`
- `type`

### 5.3 `shows.json` und `episodes.json`

Diese Dateien werden im Startumfang noch nicht aktiv genutzt, sollen aber strukturell vorbereitet werden, damit die spätere Erweiterung auf Serien ohne Formatbruch möglich ist.

---

## 6. Serverseitige Funktionen

## 6.1 Libraries auflisten

Neue API-Route:

- `GET /api/plex/index/libraries`

Verhalten:

- fragt Plex-Libraries live ab
- filtert relevante Sektionen
- liefert die Liste für UI und Sync-Auswahl

Wenn Plex offline ist:

- Route darf kontrolliert fehlschlagen oder ein leeres Ergebnis mit Statusinfo liefern
- bestehende lokale Indexdateien dürfen dadurch nicht beschädigt werden

## 6.2 Library synchronisieren

Neue API-Route:

- `POST /api/plex/index/sync`

Verhalten:

- synchronisiert eine oder mehrere angegebene Libraries
- liest Metadaten aus Plex
- speichert Filme lokal in `movies.json`
- lädt Poster lokal herunter
- aktualisiert `libraries.json`

Anforderungen:

- idempotent
- robust bei Teilfehlern
- kein Löschen fremder Dateien außerhalb von `data/plex-index`

## 6.3 Lokalen Index lesen

Neue API-Routen:

- `GET /api/plex/index/movies`
- optional später: `GET /api/plex/index/shows`

Verhalten:

- lesen ausschließlich lokale Dateien
- funktionieren auch bei ausgeschaltetem NAS

---

## 7. UI

Neue UI-Seite, z. B.:

- `pages/plex-index.vue`

Startumfang der Darstellung:

- Filmgrid oder Filmliste
- Poster/Bild
- Titel
- Erscheinungsjahr
- optional kurze Zusammenfassung

Anforderungen:

- Anzeige muss ohne Live-Plex-Verbindung funktionieren
- UI liest den lokalen Index über API
- keine direkte Plex-Abfrage im Client

Zusätzlich sinnvoll:

- Sync-Button für manuelle Aktualisierung
- Anzeige von `lastSyncAt`
- Hinweis, wenn nur Offline-Daten angezeigt werden

---

## 8. Poster-Handling

Poster sollen lokal gespeichert werden, damit das UI offline funktioniert.

Anforderungen:

- Dateiname stabil aus `ratingKey`
- Ablage je Library in Unterordnern
- relative Pfade im JSON speichern
- UI lädt Poster aus lokalem Speicher statt direkt aus Plex

Empfohlene Ablage:

- `data/plex-index/posters/<libraryKey>/<ratingKey>.jpg`

Wenn ein Poster-Download fehlschlägt:

- Filmeintrag trotzdem speichern
- `posterPath` darf leer oder `null` sein
- Fehler nur loggen, nicht Gesamtsync abbrechen

---

## 9. Fehlerverhalten

Passend zum Projekt gelten diese Regeln:

- Fehler werden geloggt
- Teilfehler brechen den Gesamtsync möglichst nicht hart ab
- lokale Indexdateien werden nur kontrolliert überschrieben
- ein fehlender Plex-Zugriff darf bestehende Offline-Daten nicht zerstören

Beispiele:

- Plex nicht erreichbar -> Sync fehlgeschlagen, alter Index bleibt erhalten
- Poster einzelner Filme nicht ladbar -> restlicher Sync läuft weiter
- fehlerhafte Library -> andere Libraries können trotzdem synchronisiert werden

---

## 10. Datenmodell-Vorbereitung für Serien

Obwohl Serien noch nicht vollständig umgesetzt werden, soll das Datenmodell bereits diese Trennung erlauben:

- `movie`
- `show`
- `episode`

Empfohlene spätere Beziehungen:

- `shows.json` enthält Serien-Metadaten
- `episodes.json` enthält Episoden mit Referenz auf `showRatingKey`

Damit bleibt der Film-Startumfang klein, ohne den späteren Ausbau zu blockieren.

---

## 11. Implementierungsregeln

Die Erweiterung muss diese Projektgrenzen einhalten:

- keine Datenbank
- keine Änderung des zentralen File-State-Prinzips
- keine Verlagerung von Automationslogik in den Client
- Schreibzugriffe nur unter `data/`
- kleine, isolierte Erweiterungen statt großem Refactor

---

## 12. Empfohlene Umsetzungsschritte

1. Runtime-Konfiguration für `PLEX_INDEX_DIR` ergänzen
2. Utility für Index-Pfade und Dateizugriffe unter `server/utils/` anlegen
3. API zum Auflisten der Plex-Libraries implementieren
4. API zum Synchronisieren von Film-Libraries implementieren
5. Poster-Download und lokale Ablage ergänzen
6. API zum Lesen des lokalen Filmindex ergänzen
7. UI-Seite für Offline-Filmübersicht bauen

---

## 13. Erfolgskriterium

Die Erweiterung ist erfolgreich, wenn:

- Filme aus lokalem Index sichtbar sind, auch wenn NAS/Plex offline sind
- Poster, Titel und Jahr angezeigt werden
- Sync reproduzierbar und idempotent läuft
- bestehende Automationsfunktionen unverändert weiterlaufen
- alle persistierten Daten ausschließlich unter `data/` liegen
