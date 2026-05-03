<script setup lang="ts">
import { computed, onMounted, ref } from "vue"

type Library = {
  key: string
  title: string
  type: string
  lastSyncAt?: string | null
  itemCount?: number
}

type Movie = {
  ratingKey: string
  libraryKey: string
  title: string
  originalTitle?: string | null
  year?: number | null
  summary?: string | null
}

const loading = ref(true)
const syncing = ref(false)
const libraries = ref<Library[]>([])
const movies = ref<Movie[]>([])
const selectedLibrary = ref("")
const search = ref("")
const updatedAt = ref<string | null>(null)
const source = ref("local")
const error = ref<string | null>(null)

const filteredMovies = computed(() => movies.value)

function posterUrl(movie: Movie) {
  return `/api/plex/index/poster?libraryKey=${encodeURIComponent(movie.libraryKey)}&ratingKey=${encodeURIComponent(movie.ratingKey)}`
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

async function loadLibraries() {
  const res = await $fetch<{ items: Library[]; source: string }>("/api/plex/index/libraries")
  libraries.value = res.items
  source.value = res.source

  if (!selectedLibrary.value && libraries.value.length > 0) {
    selectedLibrary.value = libraries.value[0]!.key
  }
}

async function loadMovies() {
  const query = new URLSearchParams()
  if (selectedLibrary.value) query.set("libraryKey", selectedLibrary.value)
  if (search.value.trim()) query.set("q", search.value.trim())

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
    await loadMovies()
  } catch (err) {
    console.error(err)
    error.value = "Plex-Index konnte nicht geladen werden"
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-container>
    <v-card class="mb-4">
      <v-card-title>Plex Offline Index</v-card-title>
      <v-card-text>
        <v-row dense>
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
          <v-col cols="12" md="4" class="d-flex align-center">
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

        <div class="text-caption text-medium-emphasis mt-4">
          Letzter lokaler Index: {{ formatTimestamp(updatedAt) }}
        </div>
      </v-card-text>
    </v-card>

    <v-progress-circular v-if="loading" indeterminate />

    <v-row v-else dense>
      <v-col
        v-for="movie in filteredMovies"
        :key="movie.ratingKey"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card height="100%">
          <v-img
            :src="posterUrl(movie)"
            :alt="movie.title"
            height="360"
            cover
          />
          <v-card-title>{{ movie.title }}</v-card-title>
          <v-card-subtitle>
            {{ movie.year ?? "ohne Jahr" }}
          </v-card-subtitle>
          <v-card-text class="text-body-2">
            {{ movie.summary || "Keine Beschreibung vorhanden." }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
