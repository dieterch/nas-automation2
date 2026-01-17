<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const log = ref("");
const loading = ref(true);
const error = ref<string | null>(null);

let timer: number | undefined;

async function loadLog() {
  try {
    const res = await $fetch<{ ok: boolean; content: string }>(
      "/api/debug/automation-log",
      { cache: "no-store" }
    );

    log.value = res.content ?? "";
    error.value = null;
  } catch (e) {
    error.value = "Log konnte nicht geladen werden";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadLog();
  timer = window.setInterval(loadLog, 2000); // 2s = tail -f Gefühl
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>Automation Debug Log</v-card-title>
      <v-card-text>

        <v-alert v-if="error" type="error" class="mb-3">
          {{ error }}
        </v-alert>

        <v-progress-circular v-if="loading" indeterminate />

        <pre
          v-else
          style="
            max-height: 70vh;
            overflow-y: auto;
            background: #111;
            color: #0f0;
            padding: 12px;
            font-size: 10px;
            line-height: 1.4;
          "
        >
{{ log }}
        </pre>

      </v-card-text>
    </v-card>
  </v-container>
</template>
