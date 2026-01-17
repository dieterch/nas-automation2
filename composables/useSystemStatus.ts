import { ref } from "vue";

interface PlexStatusResponse {
  online: boolean;
  url: string | null;
}

interface ReadyResponse {
  ready: boolean;
}

interface VuPlusStatusResponse {
  on: boolean;
}

const plexReady = ref(false);
const nasReady = ref(false);
const vuPlusReady = ref(false);
const dryRun = ref(false);

export function useSystemStatus() {
  async function update() {
    // Plex
    try {
      const plexRes = await $fetch<PlexStatusResponse>("/api/status/plex");
      plexReady.value = plexRes.online;
    } catch {
      plexReady.value = false;
    }

    // NAS
    try {
      const res = await $fetch<ReadyResponse>("/api/status/nas", {
        cache: "no-store",
      });
      nasReady.value = res.ready;
    } catch {
      nasReady.value = false;
    }

    // VU+
    try {
      const res = await $fetch<VuPlusStatusResponse>("/api/vuplus/status", {
        cache: "no-store",
      });
      vuPlusReady.value = res.on;
    } catch {
      vuPlusReady.value = false;
    }

    // Dry-Run
    try {
      const res = await $fetch<{ dryRun: boolean }>("/api/automation/dry-run");
      dryRun.value = res.dryRun;
    } catch {
      dryRun.value = false;
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  if (import.meta.client && !timer) {
    timer = setInterval(update, 10_000);
    update();
  }

  return {
    plexReady,
    nasReady,
    vuPlusReady,
    dryRun,
    update,
  };
}
