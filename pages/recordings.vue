<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import type { ParsedRecording } from "../utils/plex-recording";
import { parseRecording } from "../utils/plex-recording";

/* ------------------------------------------------------------------
   MINIMALE TYPHILFE
------------------------------------------------------------------ */
// type AnyRecord = Record<string, any>
type AnyRecord = Record<any, any>;

/* ------------------------------------------------------------------
   STATES
------------------------------------------------------------------ */
const items = ref<AnyRecord[]>([]);
const loading = ref<boolean>(true);
const error = ref<any>(null);
const config = ref<AnyRecord | null>(null);
const lastFetch = ref<string | null>(null);

/* ------------------------------------------------------------------
   HILFSFUNKTIONEN
------------------------------------------------------------------ */
function toDate(secs: number): Date {
  return new Date(secs * 1000);
}

function format(d: Date | null | undefined): string {
  if (!d) return "n/a";
  return d.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function format_time(d: Date | null | undefined): string {
  if (!d) return "n/a";
  return d.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const parsedAndSorted = computed<ParsedRecording[]>(() => {
  if (!config.value) return [];

  return items.value
    .map((r) => parseRecording(r, config.value))
    .filter((r): r is ParsedRecording => r !== null)
    .sort((a, b) => a.sendungsStart.getTime() - b.sendungsStart.getTime());
});

/* ------------------------------------------------------------------
   TIMELINE GENERIEREN
------------------------------------------------------------------ */
const timelineEntries = computed<AnyRecord[]>(() => {
  if (!config.value) return [];

  const list = parsedAndSorted.value;
  const entries: AnyRecord[] = [];

  for (let i = 0; i < list.length; i++) {
    const curr = list[i]!;
    const next = list[i + 1];

    let gapMinutes: number | null = null;
    let skipShutdown = false;
    let wiederstart: Date | null = null;

    if (next) {
      const diffMs = next.aufnahmeStart.getTime() - curr.aufnahmeEnde.getTime();
      gapMinutes = Math.round(diffMs / 60000);

      if (gapMinutes < config.value.GRACE_PERIOD_MIN) {
        skipShutdown = true;
      }

      wiederstart = new Date(
        next.aufnahmeStart.getTime() -
        config.value.VORLAUF_AUFWACHEN_MIN * 60000
      );
    }

    entries.push({
      type: "recording",
      index: i + 1,
      ...curr,
      gapMinutes,
      skipShutdown,
      wiederstart,
    });

    if (!skipShutdown && next && wiederstart) {
      entries.push({
        type: "shutdown",
        from: curr.ausschaltZeit,
        to: wiederstart,
      });
    }
  }

  return entries;
});

const recordingEntries = computed(() =>
  timelineEntries.value.filter(e => e.type === "recording")
);

/* ------------------------------------------------------------------
   API LOAD
------------------------------------------------------------------ */
onMounted(async () => {
  try {
    loading.value = true;
    config.value = await $fetch("/api/config");

    // const res: AnyRecord = await $fetch("/api/plex/scheduled");
    // items.value = res.data?.MediaContainer?.MediaGrabOperation ?? [];

    // lastFetch.value = res.lastSuccessfulFetch ?? null;

    const res: AnyRecord = await $fetch("/api/plex/cache");

    items.value = res.data?.MediaContainer?.MediaGrabOperation ?? [];

    lastFetch.value = res.lastSuccessfulFetch ?? null;
  } catch (err) {
    error.value = err;
  } finally {
    loading.value = false;
  }
});

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete";

async function callApi(path: string, method: HttpMethod = "GET") {
  loading.value = true;
  try {
    const result = await $fetch(path, { method });
    return result;
  } catch (err: any) {
    throw err;
  } finally {
    loading.value = false;
  }
}

async function UpdatePlexCache() {
  await callApi("/api/plex/scheduled-refresh", "GET");
}

</script>

<template>
  <v-container>
    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <v-btn block color="blue" :loading="loading" @click="UpdatePlexCache">
          Update Plex Schedule Cache
        </v-btn>
      </v-col>
    </v-row>

    <v-card>
      <!--v-card-title>Geplante Aufnahmen</v-card-title-->
      <v-card-text>
        <v-progress-circular v-if="loading" indeterminate />

        <!--v-alert type="info" density="compact" variant="text" class="pa-0 mb-2">
          Letzter erfolgreicher Abruf:
          {{ lastFetch ? format(new Date(lastFetch)) : "nie" }}
        </v-alert-->

        <v-alert density="compact" variant="text" class="pa-0 mb-2 d-flex align-center">
          <v-icon size="14" color="grey-darken-1" class="mr-1">
            mdi-information-outline
          </v-icon>

          <span class="text-caption text-medium-emphasis">
            Letzter erfolgreicher Abruf:
            {{ lastFetch ? format(new Date(lastFetch)) : "nie" }}
          </span>
        </v-alert>


        <v-alert v-if="error" type="error">
          Fehler beim Laden der Daten
        </v-alert>

        <!-- ⬇️ KEIN Grid, EIN Panels-Container -->
        <v-expansion-panels v-if="!loading && !error" variant="accordion" class="recording-panels">
          <v-expansion-panel v-for="item in recordingEntries" :key="item.index" :bg-color="item.skipShutdown
            ? 'blue-lighten-5'
            : 'blue-lighten-4'
            " elevation="0">
            <!-- HEADER -->
            <v-expansion-panel-title class="py-1 text-body-2 d-flex align-center">
              <v-icon size="16" class="mr-1">mdi-record-rec</v-icon>
              <span class="font-weight-medium">
                {{ item.index }} {{ item.displayTitle }}
              </span>
            </v-expansion-panel-title>

            <!-- DETAILS -->
            <v-expansion-panel-text class="py-1 px-2">
              <v-table density="compact">
                <tbody>
                  <tr>
                    <td class="label">Geräte</td>
                    <td>{{ format(item.einschaltZeit) }}</td>
                    <td>{{ format(item.ausschaltZeit) }}</td>
                  </tr>
                  <tr>
                    <td class="label">Aufnahme</td>
                    <td>{{ format(item.aufnahmeStart) }}</td>
                    <td>{{ format(item.aufnahmeEnde) }}</td>
                  </tr>
                  <tr>
                    <td class="label">Sendung</td>
                    <td>{{ format(item.sendungsStart) }}</td>
                    <td>{{ format(item.sendungsEnde) }}</td>
                  </tr>
                  <tr v-if="item.gapMinutes !== null">
                    <td class="label">Shutdown</td>
                    <td>
                      {{
                        item.skipShutdown
                          ? "kein Shutdown"
                          : item.gapMinutes + " Min. Pause"
                      }}
                    </td>
                    <td>
                      {{ item.skipShutdown ? "-" : format(item.wiederstart) }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.label {
  font-weight: 600;
  white-space: nowrap;
  padding-right: 8px;
}

.v-table td {
  padding: 2px 6px !important;
  font-size: 12px;
}
</style>
