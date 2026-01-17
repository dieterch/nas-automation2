import { ref } from "vue";

interface PlexStatusResponse {
  status: "red" | "yellow" | "green";
  url: string | null;
}

interface ReadyResponse {
  ready: boolean;
}

interface VuPlusStatusResponse {
  on: boolean;
}

const plexStatus = ref<PlexStatusResponse | null>(null);
// const plexStatus = ref<PlexStatus>("red");
const nasReady = ref(false);
const vuPlusReady = ref(false);

export function useSystemStatus() {
  async function update() {
    // Plex
    try {
      const plexRes = await $fetch<PlexStatusResponse>("/api/status/plex");
      plexStatus.value = plexRes;
    } catch {
      plexStatus.value = {
        status: "red",
        url: null,
      };
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
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  if (import.meta.client && !timer) {
    timer = setInterval(update, 10_000);
    update();
  }

  return {
    plexStatus,
    nasReady,
    vuPlusReady,
    update,
  };
}
