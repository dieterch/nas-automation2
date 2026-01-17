<script setup lang="ts">
import { ref, onMounted } from "vue";

type Any = any;

const loading = ref(true);
const error = ref<string | null>(null);

const data = ref<Any | null>(null);

function format(d: string | Date | null) {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

onMounted(async () => {
  try {
    loading.value = true;
    data.value = await $fetch("/api/automation/status");
  } catch {
    error.value = "Fehler beim Laden der Automationsdaten";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>Automation</v-card-title>
      <v-card-text>
        <!-- LOADING -->
        <v-progress-circular v-if="loading" indeterminate />

        <!-- ERROR -->
        <v-alert v-if="error" type="error">
          {{ error }}
        </v-alert>

        <template v-if="!loading && !error && data">
          <!-- WHY / EXPLANATION -->
          <v-alert>
            <strong>{{ data.explanation.title }}</strong
            ><br />
            {{ data.explanation.description }}

            <span v-if="data.activeWindow">
              <br /><br />
              ⏱ Aktiv wegen Zeitfenster ({{ data.activeWindow.type }})
            </span>
          </v-alert>

          <!-- ACTIVE SCHEDULE WINDOW -->
          <v-card v-if="data.activeWindow" variant="tonal" class="mb-4">
            <v-card-title>Aktives Zeitfenster</v-card-title>
            <v-card-text>
              <v-table density="compact">
                <tbody>
                  <tr>
                    <td><strong>Typ</strong></td>
                    <td>
                      <v-chip size="small" label color="blue">
                        {{ data.activeWindow.type }}
                      </v-chip>
                    </td>
                  </tr>

                  <tr v-if="data.activeWindow.label">
                    <td><strong>Beschreibung</strong></td>
                    <td>{{ data.activeWindow.label }}</td>
                  </tr>

                  <tr>
                    <td><strong>Zeitraum</strong></td>
                    <td>
                      {{ data.activeWindow.start }} –
                      {{ data.activeWindow.end }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>

          <!-- STATUS -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Status</v-card-title>
            <v-card-text>
              <v-table density="compact">
                <tbody>
                  <tr>
                    <td><strong>Automation State</strong></td>
                    <td>
                      <v-chip
                        size="small"
                        label
                        :color="
                          data.automation.state === 'RUNNING' 
                            ? 'green'
                            : data.automation.state === 'STARTING'
                            ? 'blue'
                            : data.automation.state === 'SHUTTING_DOWN'
                            ? 'orange'
                            : data.automation.state === 'ERROR'
                            ? 'red'
                            : data.automation.state === 'DRY_RUN'
                            ? 'brown'
                            : 'grey'
                        "
                      >
                        {{ data.automation.state }}
                      </v-chip>
                    </td>
                  </tr>

                  <tr>
                    <td><strong>Seit</strong></td>
                    <td>{{ format(data.automation.since) }}</td>
                  </tr>

                  <tr>
                    <td><strong>Letzte Decision</strong></td>
                    <td>{{ data.automation.lastDecision ?? "–" }}</td>
                  </tr>

                  <tr>
                    <td><strong>Grund (intern)</strong></td>
                    <td>{{ data.automation.reason ?? "–" }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>

          <v-alert
            v-if="data.activeWindow"
            type="info"
            density="compact"
            class="mb-4"
          >
            Aktives Zeitfenster:
            <strong>{{ data.activeWindow.label }}</strong>
            ({{ data.activeWindow.start }} – {{ data.activeWindow.end }})
          </v-alert>

          <!-- DEVICES -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Geräte</v-card-title>
            <v-card-text>
              <v-table density="compact">
                <tbody>
                  <tr>
                    <td><strong>NAS</strong></td>
                    <td>
                      <v-chip
                        size="small"
                        label
                        :color="data.devices.nas === 'on' ? 'green' : 'red'"
                      >
                        {{ data.devices.nas }}
                      </v-chip>
                    </td>
                  </tr>

                  <tr>
                    <td><strong>Vu+</strong></td>
                    <td>
                      <v-chip
                        size="small"
                        label
                        :color="data.devices.vuplus === 'on' ? 'green' : 'red'"
                      >
                        {{ data.devices.vuplus }}
                      </v-chip>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>

          <!-- NEXT EVENT -->
          <v-card variant="tonal">
            <v-card-title>Nächstes Ereignis</v-card-title>
            <v-card-text>
              <v-alert
                v-if="data.nextEvent?.type === 'none'"
                type="info"
                density="compact"
              >
                Kein kommendes Ereignis
              </v-alert>

              <v-table v-else density="compact">
                <tbody>
                  <tr>
                    <td><strong>Titel</strong></td>
                    <td>{{ data.nextEvent.title }}</td>
                  </tr>
                  <tr>
                    <td><strong>Einschalten</strong></td>
                    <td>{{ format(data.nextEvent.einschaltZeit) }}</td>
                  </tr>
                  <tr>
                    <td><strong>Aufnahme</strong></td>
                    <td>
                      {{ format(data.nextEvent.aufnahmeStart) }}
                      –
                      {{ format(data.nextEvent.aufnahmeEnde) }}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Ausschalten</strong></td>
                    <td>{{ format(data.nextEvent.ausschaltZeit) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </template>
      </v-card-text>
    </v-card>
  </v-container>
</template>
