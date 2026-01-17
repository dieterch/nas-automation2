<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
const cfg = useRuntimeConfig();

const data = ref<any | null>(null);
const debugData = ref<any | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

/**
 * v-expansion-panels erwartet ein Array (mehrere Panels möglich)
 */
const debugPanels = ref<number[]>([]);

async function load(debug = false) {
  try {
    const url = "/api/automation/status";
    const res = await $fetch(url, { cache: "no-store" });
    data.value = res;
  } catch {
    error.value = "Dashboard konnte nicht geladen werden";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  setInterval(load, 10_000);
});

/**
 * Lazy Debug Fetch – erst wenn Panel geöffnet wird
 */
watch(debugPanels, (panels) => {
  if (panels.length > 0 && !debugData.value) {
    load(true);
  }
});

function format(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const automationColor = computed(() =>
  data.value.automation.state === "ON"
    ? "rgba(46,125,50,.15)"
    : "rgba(198,40,40,.12)"
);

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

async function vuOn() {
  await callApi("/api/vuplus/on", "POST");
}

async function vuOff() {
  await callApi("/api/vuplus/off", "POST");
}

async function orf1() {
  await $fetch(
    `http://${cfg.public.VUPLUS_IP}/api/zap?sRef=${cfg.public.ORF1}`
  );
}

async function UpdatePlexCache() {
  await callApi("/api/plex/scheduled-refresh", "GET");
}

async function ProxmoxSchedule() {
  await callApi("/api/proxmox/schedule", "POST");
}

async function AddWindowUntilMidnight() {
  await callApi("/api/manual/start", "POST");
  await callApi("/api/automation/tick", "POST");
}

async function RemoveWindowUntilMidnight() {
  await callApi("/api/manual/stop", "POST");
  await callApi("/api/automation/tick", "POST");
}
</script>

<template>
  <v-container>
    <!-- Action Buttons -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row class="mb-0" dense>
          <v-col cols="12" md="4">
            <v-btn
              block
              variant="tonal"
              ncolor="primary"
              elevation="2"
              class="btn-wrap"
              @click="AddWindowUntilMidnight"
            >
              NAS on until 24h
            </v-btn>
          </v-col>

          <v-col cols="12" md="4">
            <v-btn
              block
              variant="tonal"
              ncolor="primary"
              elevation="2"
              class="btn-wrap"
              @click="RemoveWindowUntilMidnight"
            >
              Remove NAS on until 24h
            </v-btn>
          </v-col>

          <v-col cols="12" md="4">
            <v-btn
              block
              variant="tonal"
              ncolor="primary"
              elevation="2"
              class="btn-wrap"
              @click="UpdatePlexCache"
            >
              Update Plex Cache
            </v-btn>
          </v-col>

          <v-col cols="12" md="4">
            <v-btn
              block
              variant="tonal"
              ncolor="primary"
              elevation="2"
              class="btn-wrap"
              @click="vuOn"
            >
              VU+ On
            </v-btn>
          </v-col>

          <v-col cols="12" md="4">
            <v-btn
              block
              variant="tonal"
              ncolor="primary"
              elevation="2"
              class="btn-wrap"
              @click="vuOff"
            >
              VU+ Off
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-progress-circular v-if="loading" indeterminate />
    <v-alert v-else-if="error" type="error">{{ error }}</v-alert>

    <template v-else-if="data">
      <!-- AUTOMATION -->
      <v-card
        v-if="data?.automation"
        class="mb-4"
        :color="automationColor"
        novariant="tonal"
      >
        <v-card-title>Status</v-card-title>
        <v-card-text>
          {{ data.automation.state }}
          seit {{ format(data.automation.since) }} ({{
            data.automation.sinceHuman
          }})
        </v-card-text>
      </v-card>

      <!-- COUNTS -->
      <v-card class="mb-4" color="blue-grey-lighten-2" novariant="tonal">
        <v-card-title>Ereignisse</v-card-title>
        <v-card-text>
          <table style="width: 50%">
            <tbody>
              <tr>
                <th style="width: 40%; text-align: left">Typ</th>
                <th style="width: 30%; text-align: left">laufend</th>
                <th style="width: 30%; text-align: left">geplant</th>
              </tr>
              <tr>
                <td><a href="/recordings">Aufnahmen</a></td>
                <td>{{ data.counts.recordingsRunning }}</td>
                <td>{{ data.counts.recordingsUpcoming }}</td>
              </tr>
              <tr>
                <td><a href="/settings">Zeitfenster</a></td>
                <td>{{ data.counts.windowsActive }}</td>
                <td>{{ data.counts.windowsTotal }}</td>
              </tr>
            </tbody>
          </table>
        </v-card-text>
      </v-card>

      <v-card
        v-if="data.runningRecordings.length > 0"
        class="mb-0"
        title="Laufende Aufnahmen"
        color="green-lighten-3"
        novariant="tonal"
      >
        <v-list density="compact" class="py-0" bg-color="green-lighten-3">
          <v-list-item
            v-for="r in data.runningRecordings"
            :key="r.displayTitle"
          >
            <v-list-item-title>
              {{ r.displayTitle }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ formatTime(r.sendungsStart) }} –
              {{ formatTime(r.sendungsEnde) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card
        v-if="data?.next?.recording"
        class="mb-4"
        title="Nächste Aufnahme"
        novariant="tonal"
        color="green-lighten-5"
      >
        <v-list
          density="compact"
          class="py-0"
          style="background-color: transparent"
        >
          <v-list-item
            :title="data.next.recording.title"
            :subtitle="`in ${data.next.recording.inHuman}, ${format(
              data.next.recording.at
            )}`"
          />
        </v-list>
      </v-card>

      <v-card
        v-if="data?.activeWindows?.length > 0"
        class="mb-0"
        title="Aktive Zeitfenster"
        color="blue-lighten-3"
        novariant="tonal"
      >
        <v-list density="compact" class="py-0" bg-color="blue-lighten-3">
          <v-list-item v-for="w in data.activeWindows" :key="w.id">
            <v-list-item-title>
              {{ w.id ?? "Zeitfenster" }}
            </v-list-item-title>

            <v-list-item-subtitle>
              {{ w.start }} – {{ w.end }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card
        v-if="data?.next?.window"
        class="mb-4"
        title="Nächstes Zeitfenster"
        novariant="tonal"
        color="blue-lighten-5"
      >
        <v-list
          density="compact"
          class="py-0"
          style="background-color: transparent"
        >
          <v-list-item
            :title="data.next.window.title"
            :subtitle="`in ${data.next.window.inHuman}, ${format(
              data.next.window.at
            )}`"
          />
        </v-list>
      </v-card>

      <pre>


























{{ data }}
</pre
      >
    </template>
  </v-container>
</template>
<style scoped>
a {
  text-decoration: none;
  color: aliceblue;
}
</style>
