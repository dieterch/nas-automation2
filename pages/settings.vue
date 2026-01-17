<script setup lang="ts">
import { ref, onMounted } from "vue";
const cfg = useRuntimeConfig()

/* ================= TYPES ================= */

interface ScheduledPeriod {
  _uid: string;
  id: string;
  active: boolean;
  type: "daily" | "weekly" | "once";
  start: string;
  end: string;
  date?: string;
  weekdays?: number[];
}

interface Config {
  VORLAUF_AUFWACHEN_MIN: number;
  AUSSCHALT_NACHLAUF_MIN: number;
  GRACE_PERIOD_MIN: number;

  TICK_INTERVAL_SEC: number;
  REC_SCHEDULE_INTERVALL: number;

  AUTOMATION_ACTIONS_ENABLED: boolean;

  NIGHT_PERIOD: {
    enabled: boolean;
    start: string;
    end: string;
  };

  SCHEDULED_ON_PERIODS: ScheduledPeriod[];

  SHELLY: {
    NAS: { enabled: boolean };
    VUPLUS: { enabled: boolean };
  };

  PROXMOX: {
    enabled: boolean;
  };
}

/* ================= STATE ================= */

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const config = ref<Config | null>(null);

/* ================= HELPERS ================= */

function resetMessages() {
  error.value = null;
  success.value = null;
}

function makeUid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function normalizeSchedules() {
  if (!config.value) return;
  config.value.SCHEDULED_ON_PERIODS = config.value.SCHEDULED_ON_PERIODS.map(
    (p) => ({
      ...p,
      _uid: p._uid ?? makeUid(),
    })
  );
}

/* ================= LOAD ================= */
async function loadconfig() {
  const data = await $fetch<Config>("/api/config");
  config.value = data;
  normalizeSchedules();
}

onMounted(async () => {
  resetMessages();
  loading.value = true;
  try {
    // const data = await $fetch<Config>("/api/config")
    // config.value = data
    // normalizeSchedules()
    await loadconfig();
  } catch (e) {
    console.error(e);
    error.value = "Konfiguration konnte nicht geladen werden";
  } finally {
    loading.value = false;
  }
});

/* ================= SAVE ================= */

async function saveConfig() {
  if (!config.value) return;
  resetMessages();
  saving.value = true;
  try {
    await $fetch("/api/config", {
      method: "POST",
      body: config.value,
    });
    success.value = "Konfiguration gespeichert";
  } catch (e) {
    console.error(e);
    error.value = "Fehler beim Speichern der Konfiguration";
  } finally {
    saving.value = false;
  }
}

/* ================= SCHEDULE ACTIONS ================= */

function addScheduledPeriod() {
  if (!config.value) return;
  config.value.SCHEDULED_ON_PERIODS.push({
    _uid: makeUid(),
    id: "",
    active: true,
    type: "daily",
    start: "00:00",
    end: "00:00",
  });
}

function removeScheduledPeriod(uid: string) {
  if (!config.value) return;
  config.value.SCHEDULED_ON_PERIODS = config.value.SCHEDULED_ON_PERIODS.filter(
    (p) => p._uid !== uid
  );
}

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
  await $fetch(`http://${cfg.public.VUPLUS_IP}/api/zap?sRef=${cfg.public.ORF1}`);
}

async function UpdatePlexCache() {
  await callApi("/api/plex/scheduled-refresh", "GET");
}

async function ProxmoxSchedule() {
  await callApi("/api/proxmox/schedule", "POST");
  await loadconfig();
}

async function AddWindowUntilMidnight() {
  await callApi("/api/manual/start", "POST");
  await loadconfig();
  await callApi("/api/automation/tick", "POST");
}

async function RemoveWindowUntilMidnight() {
  await callApi("/api/manual/stop", "POST");
  await loadconfig();
  await callApi("/api/automation/tick", "POST");
}


</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>Einstellungen</v-card-title>
      <v-card-text>
        <v-progress-circular v-if="loading" indeterminate />

        <v-alert v-if="error && !loading" type="error" class="mb-4">
          {{ error }}
        </v-alert>

        <v-alert v-if="success" type="success" class="mb-4">
          {{ success }}
        </v-alert>

              <v-row class="mb-4" dense>

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

        <template v-if="config">
          <!-- ================= ZEITEN ================= -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Aufnahme-Zeiten</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.VORLAUF_AUFWACHEN_MIN"
                    label="Vorlauf Aufwachen (Min)"
                    type="number"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.AUSSCHALT_NACHLAUF_MIN"
                    label="Ausschalt-Nachlauf (Min)"
                    type="number"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.GRACE_PERIOD_MIN"
                    label="Grace Period (Min)"
                    type="number"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- ================= AUTOMATION ================= -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Automation</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.TICK_INTERVAL_SEC"
                    label="Tick-Intervall (Sekunden)"
                    type="number"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.REC_SCHEDULE_INTERVALL"
                    label="Plex-Refresh (Sekunden)"
                    type="number"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-switch
                    v-model="config.AUTOMATION_ACTIONS_ENABLED"
                    label="Automation aktiv"
                    inset
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- ================= NIGHT PERIOD ================= -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Nachtperiode</v-card-title>
            <v-card-text>
              <v-switch
                v-model="config.NIGHT_PERIOD.enabled"
                label="Nachtmodus aktiv"
                inset
                class="mb-4"
              />
              <v-row v-if="config.NIGHT_PERIOD.enabled">
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.NIGHT_PERIOD.start"
                    label="Start (HH:MM)"
                    type="time"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.NIGHT_PERIOD.end"
                    label="Ende (HH:MM)"
                    type="time"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- ================= SCHEDULES ================= -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Geplante Zeitfenster</v-card-title>
            <v-card-text>
              <v-card
                v-for="p in config.SCHEDULED_ON_PERIODS"
                :key="p._uid"
                class="mb-4"
                variant="outlined"
              >
                <v-card-text>
                  <v-text-field v-model="p.id" label="ID" class="mb-3" />

                  <v-row>
                    <v-col cols="12" md="2">
                      <v-switch v-model="p.active" label="Aktiv" inset />
                    </v-col>

                    <v-col cols="12" md="3">
                      <v-select
                        v-model="p.type"
                        label="Typ"
                        :items="['daily', 'weekly', 'once']"
                      />
                    </v-col>

                    <v-col cols="6" md="2">
                      <v-text-field
                        v-model="p.start"
                        type="time"
                        label="Start"
                      />
                    </v-col>

                    <v-col cols="6" md="2">
                      <v-text-field v-model="p.end" type="time" label="Ende" />
                    </v-col>

                    <v-col cols="12" md="1">
                      <v-btn
                        icon="mdi-delete"
                        color="red"
                        variant="text"
                        @click="removeScheduledPeriod(p._uid)"
                      />
                    </v-col>
                  </v-row>

                  <!-- WEEKLY -->
                  <v-row v-if="p.type === 'weekly'">
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="p.weekdays"
                        multiple
                        label="Wochentage"
                        :items="[
                          { title: 'Mo', value: 1 },
                          { title: 'Di', value: 2 },
                          { title: 'Mi', value: 3 },
                          { title: 'Do', value: 4 },
                          { title: 'Fr', value: 5 },
                          { title: 'Sa', value: 6 },
                          { title: 'So', value: 0 },
                        ]"
                      />
                    </v-col>
                  </v-row>

                  <!-- ONCE -->
                  <v-row v-if="p.type === 'once'">
                    <v-col cols="12" md="4">
                      <v-text-field
                        v-model="p.date"
                        type="date"
                        label="Datum"
                      />
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>

              <v-row class="mb-4" dense>
                <v-col cols="12" md="3">
                  <v-btn
                    block
                    variant="tonal"
                    ncolor="primary"
                    elevation="2"
                    class="btn-wrap"
                    @click="addScheduledPeriod"
                  >
                    Zeitfenster hinzufügen
                  </v-btn>
                </v-col>

                <v-col cols="12" md="3">
                  <v-btn
                    block
                    variant="tonal"
                    ncolor="primary"
                    elevation="2"
                    class="btn-wrap"
                    @click="ProxmoxSchedule"
                  >
                    Proxmox Backup eintragen
                  </v-btn>
                </v-col>

              </v-row>
            </v-card-text>
          </v-card>

          <v-btn color="primary" :loading="saving" @click="saveConfig">
            Konfiguration speichern
          </v-btn>
        </template>
      </v-card-text>
    </v-card>
  </v-container>
</template>
<style scoped>
.btn-wrap :deep(.v-btn__content) {
  white-space: normal;
  line-height: 1.2;
  font-size: 0.85rem;
  text-align: center;
}
</style>

