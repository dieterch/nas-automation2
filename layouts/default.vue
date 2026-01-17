<template>
  <v-app>
    <!-- Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" app width="260">
      <v-list density="comfortable">
        <v-list-item>
          <v-list-item-title class="text-h6">
            NAS Automation
          </v-list-item-title>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item v-for="item in menu" :key="item.to" :to="item.to" link>
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Toolbar -->
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>NAS Automation</v-toolbar-title>

      <!-- PLEX STATUS -->
      <div class="d-flex align-center mr-4">
        <v-icon :color="plexColor" size="18">mdi-circle</v-icon>
        <span class="ml-1 text-caption">Plex</span>
      </div>

      <!-- NAS STATUS -->
      <div class="d-flex align-center mr-4">
        <v-icon :color="nasColor" size="18">mdi-circle</v-icon>
        <span class="ml-1 text-caption">NAS</span>
      </div>

      <!-- VU+ STATUS -->
      <div class="d-flex align-center mr-4">
        <v-icon :color="vuPlusColor" size="18">mdi-circle</v-icon>
        <span class="ml-1 text-caption">VU+</span>
      </div>
    </v-app-bar>

    <!-- Seiteninhalt -->
    <v-main>
      <v-container fluid class="pa-4">
        <NuxtPage />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useSystemStatus } from "~/composables/useSystemStatus";

const { plexStatus, nasReady, vuPlusReady } = useSystemStatus();

const plexColor = computed(() => {
  const s = plexStatus.value?.status;
  if (s === "green") return "green";
  if (s === "yellow") return "yellow";
  return "red";
});

const nasColor = computed(() => (nasReady.value ? "green" : "red"));
const vuPlusColor = computed(() => (vuPlusReady.value ? "green" : "red"));

const drawer = ref(false);

const menu = [
  { title: "Dashboard", to: "/" },
  { title: "Aufnahmeplan", to: "/recordings" },
  //{ title: "Manual", to: "/manual" },
  { title: "Einstellungen", to: "/settings" },
  { title: "Debug", to: "/debug" },
  { title: "Timeline", to: "/timeline" },
];
</script>

