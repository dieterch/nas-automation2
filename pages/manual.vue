<script setup lang="ts">
import { ref } from "vue";
import { useSystemStatus } from "~/composables/useSystemStatus";
const cfg = useRuntimeConfig()

const log = ref("");
const loading = ref(false);

const {
  plexStatus,
  nasReady,
  vuPlusReady,
  update: refreshSystemStatus,
} = useSystemStatus();

function addLog(msg: string) {
  log.value = `[${new Date().toLocaleTimeString()}] ${msg}\n` + log.value;
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
    addLog(`${method} ${path} → ${JSON.stringify(result)}`);
    return result;
  } catch (err: any) {
    addLog(`${method} ${path} → ERROR ${err?.message ?? err}`);
    throw err;
  } finally {
    loading.value = false;
  }
}

type AlertType = "success" | "info" | "warning" | "error";

const plexAlert = computed<{
  type: AlertType;
  text: string;
} | null>(() => {
  const s = plexStatus.value;
  if (!s) return null;

  switch (s.status) {
    case "green":
      return { type: "success", text: "ONLINE" };
    case "yellow":
      return { type: "info", text: "IM WARTUNGSMODUS" };
    case "red":
      return { type: "warning", text: "OFFLINE" };
    default:
      return null;
  }
});


/* ---------------- NAS ACTIONS ---------------- */

async function nasOn() {
  await callApi("/api/manual/start", "POST")
  await refreshSystemStatus()
  await callApi("/api/automation/tick", "POST")
}

async function nasOff() {
  await callApi("/api/manual/stop", "POST")
  await refreshSystemStatus()
  await callApi("/api/automation/tick", "POST")
}


async function nasReboot() {
  await callApi("/api/nas/reboot", "POST");
  await refreshSystemStatus();
}

/* ---------------- VU+ ACTIONS ---------------- */

async function vuOn() {
  await callApi("/api/vuplus/on", "POST");
  await refreshSystemStatus();
}

async function orf1() {
  await $fetch(`http://${cfg.public.VUPLUS_IP}/api/zap?sRef=${cfg.public.ORF1}`);
  await refreshSystemStatus();
}

async function vuOff() {
  await callApi("/api/vuplus/off", "POST");
  await refreshSystemStatus();
}

async function UpdatePlexCache() {
  await callApi("/api/plex/scheduled-refresh", "GET");
  await refreshSystemStatus();
}

async function ProxmoxSchedule() {
  await callApi("/api/proxmox/schedule", "POST");
  await refreshSystemStatus();
}

</script>

<template>
  <v-container>
    <v-card class="pa-4">
      <v-card-title>
        Manuelle Steuerung & Diagnose
      </v-card-title>

      <v-divider class="my-4" />

      <!-- ================= PLEX ================= -->
      <v-card-subtitle>Plex Status</v-card-subtitle>

      <v-alert
        v-if="plexAlert"
        :type="plexAlert.type"
        density="compact"
        class="mb-3"
      >
        PLEX ist <strong>{{ plexAlert.text }}</strong>
      </v-alert>

      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-btn block color="teal" :loading="loading" @click="UpdatePlexCache">
            Update Plex Schedule Cache
          </v-btn>
        </v-col>

      </v-row>

      <v-divider class="my-4" />

      <!-- ================= NAS ================= -->
      <v-card-subtitle>NAS Status</v-card-subtitle>

      <v-alert
        :type="nasReady ? 'success' : 'warning'"
        density="compact"
        class="mb-3"
      >
        NAS ist <strong>{{ nasReady ? "ONLINE" : "OFFLINE" }}</strong>
      </v-alert>

      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-btn block color="teal" :loading="loading" @click="nasOn">
            Fenster bis Mitternacht
          </v-btn>
        </v-col>

        <v-col cols="12" md="6">
          <v-btn block color="deep-orange" :loading="loading" @click="nasOff">
            Fenster entfernen
          </v-btn>
        </v-col>
        
        <v-col cols="12" md="6">
          <v-btn block color="teal" :loading="loading" @click="ProxmoxSchedule">
            Schedule Proxmox Backup
          </v-btn>
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <!-- ================= VU+ ================= -->
      <v-card-subtitle>VU+ Receiver Status</v-card-subtitle>

      <v-alert
        :type="vuPlusReady ? 'success' : 'warning'"
        density="compact"
        class="mb-3"
      >
        VU+ ist
        <strong>{{ vuPlusReady ? "EINGESCHALTET" : "AUSGESCHALTET" }}</strong>
      </v-alert>

      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-btn block color="teal" :loading="loading" @click="vuOn">
            VU+ einschalten
          </v-btn>
        </v-col>

        <v-col cols="12" md="4">
          <v-btn block color="teal" :loading="loading" @click="orf1">
            ORF1
          </v-btn>
        </v-col>

        <v-col cols="12" md="4">
          <v-btn block color="deep-orange" :loading="loading" @click="vuOff">
            VU+ ausschalten
          </v-btn>
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <!-- ================= LOG ================= -->
      <v-card-subtitle>Log</v-card-subtitle>

      <v-textarea
        v-model="log"
        readonly
        auto-grow
        rows="10"
        label="Log-Ausgabe"
        class="mt-2"
      />
    </v-card>
  </v-container>
</template>
