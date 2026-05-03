<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

type Library = {
  key: string
  title: string
  type: string
  lastSyncAt?: string | null
  itemCount?: number
  sync?: LibrarySyncStatus
}

type LibrarySyncStatus = {
  libraryKey: string
  title: string
  itemCount: number
  posterTotal: number
  posterCompleted: number
  posterFailed: number
  status: "pending" | "syncing" | "posters" | "done" | "error"
  startedAt?: string | null
  finishedAt?: string | null
  lastError?: string | null
}

type SyncStatus = {
  isRunning: boolean
  phase: "idle" | "syncing" | "posters" | "done" | "error"
  startedAt?: string | null
  finishedAt?: string | null
  lastSuccessAt?: string | null
  lastError?: string | null
  libraries: LibrarySyncStatus[]
}

type Movie = {
  ratingKey: string
  libraryKey: string
  title: string
  originalTitle?: string | null
  year?: number | null
  addedAt?: string | null
  originallyAvailableAt?: string | null
  durationMinutes?: number | null
  summary?: string | null
}

type PosterSize = "small" | "medium" | "large"
type SortField = "recorded" | "production" | "title"
type SortDirection = "asc" | "desc"

const loading = ref(true)
const syncing = ref(false)
const libraries = ref<Library[]>([])
const movies = ref<Movie[]>([])
const selectedLibrary = ref("")
const search = ref("")
const updatedAt = ref<string | null>(null)
const source = ref("local")
const error = ref<string | null>(null)
const posterSize = ref<PosterSize>("medium")
const sortField = ref<SortField>("recorded")
const sortDirection = ref<SortDirection>("desc")
const settingsOpen = ref(false)
const posterErrors = ref<Record<string, boolean>>({})
const syncStatus = ref<SyncStatus | null>(null)
let syncPollHandle: ReturnType<typeof setInterval> | null = null

const filteredMovies = computed(() => movies.value)
const totalMovies = computed(() => filteredMovies.value.length)
const totalDurationMinutes = computed(() => {
  return filteredMovies.value.reduce((sum, movie) => sum + (movie.durationMinutes ?? 0), 0)
})
const totalDurationHours = computed(() => {
  return (totalDurationMinutes.value / 60).toFixed(1)
})
const selectedLibrarySync = computed(() => {
  return syncStatus.value?.libraries.find((item) => item.libraryKey === selectedLibrary.value) ?? null
})
const posterProgress = computed(() => {
  const current = selectedLibrarySync.value
  if (!current || current.posterTotal === 0) return 0
  return Math.round((current.posterCompleted / current.posterTotal) * 100)
})

const sizeOptions: Array<{ title: string; value: PosterSize }> = [
  { title: "Klein", value: "small" },
  { title: "Mittel", value: "medium" },
  { title: "Groß", value: "large" },
]

const sortFieldOptions: Array<{ title: string; value: SortField }> = [
  { title: "Aufnahmedatum", value: "recorded" },
  { title: "Produktionsdatum", value: "production" },
  { title: "Filmname", value: "title" },
]

const sortDirectionOptions: Array<{ title: string; value: SortDirection }> = [
  { title: "Aufsteigend", value: "asc" },
  { title: "Absteigend", value: "desc" },
]

const gridCols = computed(() => {
  switch (posterSize.value) {
    case "small":
      return { cols: 12, sm: 6, md: 4, lg: 2 }
    case "large":
      return { cols: 12, sm: 6, md: 5, lg: 4 }
    default:
      return { cols: 12, sm: 6, md: 3, lg: 2 }
  }
})

const sortValue = computed(() => `${sortField.value}-${sortDirection.value}`)

const posterHeight = computed(() => {
  switch (posterSize.value) {
    case "small":
      return 170
    case "large":
      return 360
    default:
      return 220
  }
})

function posterUrl(movie: Movie) {
  return `/api/plex/index/poster?libraryKey=${encodeURIComponent(movie.libraryKey)}&ratingKey=${encodeURIComponent(movie.ratingKey)}`
}

function posterKey(movie: Movie) {
  return `${movie.libraryKey}:${movie.ratingKey}`
}

function markPosterError(movie: Movie) {
  posterErrors.value[posterKey(movie)] = true
}

function clearPosterError(movie: Movie) {
  delete posterErrors.value[posterKey(movie)]
}

function formatTimestamp(value?: string | null) {
  if (!value) return "–"
  return new Date(value).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatShortDate(value?: string | null) {
  if (!value) return "–"
  return new Date(value).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

async function loadLibraries() {
  const res = await $fetch<{ items: Library[]; source: string; syncStatus?: SyncStatus }>(
    "/api/plex/index/libraries"
  )
  libraries.value = res.items
  source.value = res.source
  syncStatus.value = res.syncStatus ?? syncStatus.value

  if (!selectedLibrary.value && libraries.value.length > 0) {
    selectedLibrary.value = libraries.value[0]!.key
  }
}

async function loadSyncStatus() {
  syncStatus.value = await $fetch<SyncStatus>("/api/plex/index/status")
}

function ensureSyncPolling() {
  if (syncPollHandle) return

  syncPollHandle = setInterval(async () => {
    try {
      await loadSyncStatus()
      if (!syncStatus.value?.isRunning) {
        stopSyncPolling()
        await loadLibraries()
      }
    } catch (err) {
      console.error(err)
    }
  }, 3000)
}

function stopSyncPolling() {
  if (!syncPollHandle) return
  clearInterval(syncPollHandle)
  syncPollHandle = null
}

async function loadMovies() {
  const query = new URLSearchParams()
  if (selectedLibrary.value) query.set("libraryKey", selectedLibrary.value)
  if (search.value.trim()) query.set("q", search.value.trim())
  query.set("sort", sortValue.value)

  const res = await $fetch<{ items: Movie[]; updatedAt: string | null }>(
    `/api/plex/index/movies${query.size ? `?${query.toString()}` : ""}`
  )

  movies.value = res.items
  updatedAt.value = res.updatedAt
}

async function syncSelected() {
  syncing.value = true
  error.value = null
  try {
    await $fetch("/api/plex/index/sync", {
      method: "POST",
      body: {
        libraryKeys: selectedLibrary.value ? [selectedLibrary.value] : [],
      },
    })

    await loadSyncStatus()
    ensureSyncPolling()
    await loadLibraries()
    await loadMovies()
  } catch (err) {
    console.error(err)
    error.value = "Synchronisierung fehlgeschlagen"
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  try {
    await loadLibraries()
    await loadSyncStatus()
    await loadMovies()
    if (syncStatus.value?.isRunning) {
      ensureSyncPolling()
    }
  } catch (err) {
    console.error(err)
    error.value = "Plex-Index konnte nicht geladen werden"
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  stopSyncPolling()
})
</script>

<template>
  <v-container>
    <v-card class="mb-4">
      <v-card-title>Plex Offline Index</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="1" class="d-flex align-center">
            <v-menu v-model="settingsOpen" :close-on-content-click="false">
              <template #activator="{ props }">
                <v-btn
                  icon="mdi-menu"
                  variant="tonal"
                  aria-label="Einstellungen"
                  v-bind="props"
                />
              </template>

              <v-card min-width="320">
                <v-card-title class="text-subtitle-1">
                  Anzeige
                </v-card-title>
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-2">
                    Postergröße
                  </div>
                  <v-btn-toggle
                    v-model="posterSize"
                    mandatory
                    divided
                    density="comfortable"
                    class="mb-4"
                  >
                    <v-btn
                      v-for="option in sizeOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.title }}
                    </v-btn>
                  </v-btn-toggle>

                  <v-select
                    v-model="sortField"
                    label="Sortieren nach"
                    :items="sortFieldOptions"
                    item-title="title"
                    item-value="value"
                    hide-details
                    class="mb-3"
                    @update:model-value="loadMovies"
                  />

                  <v-radio-group
                    v-model="sortDirection"
                    label="Reihenfolge"
                    hide-details
                    inline
                    @update:model-value="loadMovies"
                  >
                    <v-radio
                      v-for="option in sortDirectionOptions"
                      :key="option.value"
                      :label="option.title"
                      :value="option.value"
                    />
                  </v-radio-group>
                </v-card-text>
              </v-card>
            </v-menu>
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="selectedLibrary"
              label="Mediathek"
              :items="libraries"
              item-title="title"
              item-value="key"
              hide-details
              @update:model-value="loadMovies"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="search"
              label="Suche"
              hide-details
              clearable
              @update:model-value="loadMovies"
            />
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center ga-2">
            <v-btn color="primary" :loading="syncing" @click="syncSelected">
              Mediathek synchronisieren
            </v-btn>
          </v-col>
        </v-row>

        <v-alert
          v-if="source === 'local'"
          type="info"
          density="compact"
          class="mt-4"
        >
          Plex-Live-Daten sind nicht verfügbar. Es werden lokale Indexdaten angezeigt.
        </v-alert>

        <v-alert
          v-if="error"
          type="error"
          density="compact"
          class="mt-4"
        >
          {{ error }}
        </v-alert>

        <v-alert
          v-if="syncStatus?.isRunning"
          type="info"
          density="compact"
          class="mt-4"
        >
          <div>
            Synchronisierung läuft
            <span v-if="selectedLibrarySync">
              : {{ selectedLibrarySync.title }}
              ({{ selectedLibrarySync.posterCompleted }}/{{ selectedLibrarySync.posterTotal }} Poster,
              {{ posterProgress }}%)
            </span>
          </div>
        </v-alert>

        <v-alert
          v-else-if="selectedLibrarySync?.posterFailed"
          type="warning"
          density="compact"
          class="mt-4"
        >
          Poster-Nachladen beendet mit {{ selectedLibrarySync.posterFailed }} Fehlern.
        </v-alert>

        <v-row dense class="mt-4">
          <v-col cols="12" md="4">
            <div class="text-caption text-medium-emphasis">
              Filme: {{ totalMovies }}
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-caption text-medium-emphasis">
              Laufzeit: {{ totalDurationHours }} Stunden
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-caption text-medium-emphasis">
              Letzter lokaler Index: {{ formatTimestamp(updatedAt) }}
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-caption text-medium-emphasis">
              Letzter erfolgreicher Sync:
              {{ formatTimestamp(syncStatus?.lastSuccessAt) }}
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-progress-circular v-if="loading" indeterminate />

    <v-row v-else dense>
      <v-col
        v-for="movie in filteredMovies"
        :key="movie.ratingKey"
        :cols="gridCols.cols"
        :sm="gridCols.sm"
        :md="gridCols.md"
        :lg="gridCols.lg"
      >
        <v-card height="100%">
          <div
            class="poster-frame d-flex align-center justify-center"
            :style="{ height: `${posterHeight}px` }"
          >
            <img
              v-if="!posterErrors[posterKey(movie)]"
              :src="posterUrl(movie)"
              :alt="movie.title"
              class="poster-image"
              @error="markPosterError(movie)"
              @load="clearPosterError(movie)"
            >
            <div
              v-else
              class="poster-fallback d-flex flex-column align-center justify-center"
            >
              <v-icon size="48" color="grey-darken-1">
                mdi-image-off-outline
              </v-icon>
              <div class="text-caption text-medium-emphasis text-center px-4">
                Kein Poster lokal vorhanden
              </div>
            </div>
          </div>
          <v-card-title>{{ movie.title }}</v-card-title>
          <div class="movie-meta text-caption text-medium-emphasis">
            <span>Prod: {{ movie.year ?? "ohne Jahr" }}</span>
            <span>Aufn: {{ formatShortDate(movie.addedAt) }}</span>
          </div>
          <v-card-text class="text-body-2 summary-text">
            {{ movie.summary || "Keine Beschreibung vorhanden." }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.poster-frame {
  overflow: hidden;
}

.poster-fallback {
  width: 100%;
  height: 100%;
  gap: 12px;
}

.poster-image {
  display: block;
  width: auto;
  max-width: 100%;
  height: 100%;
  object-fit: contain;
}

.summary-text {
  max-height: 12em;
  overflow-y: auto;
  line-height: 1.5;
}

.movie-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 16px 8px;
}
</style>
