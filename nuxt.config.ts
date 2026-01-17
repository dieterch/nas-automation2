// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config'
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  devServer: {
    port: 4800,
    host: "0.0.0.0",
  },
    sourcemap: {
    server: true,
    client: true
  },
  runtimeConfig: {
    plexHost: process.env.PLEX_HOST,
    plexToken: process.env.PLEX_TOKEN,

    NAS_IP: process.env.NAS_IP,
    NAS_SSH_USER: process.env.NAS_SSH_USER,
    NAS_SSH_PASS: process.env.NAS_SSH_PASS,
    NAS_SSH_PORT: process.env.NAS_SSH_PORT,

    
    NAS_SHELLY_IP: process.env.NAS_SHELLY_IP,
    NAS_SHELLY_RELAY: process.env.NAS_SHELLY_RELAY,
    VUPLUS_SHELLY_IP: process.env.VUPLUS_SHELLY_IP,
    VUPLUS_SHELLY_RELAY: process.env.VUPLUS_SHELLY_RELAY,
    
    proxmoxHost: process.env.PROXMOX_HOST,
    proxmoxNode: process.env.PROXMOX_NODE,
    proxmoxTokenId: process.env.PROXMOX_TOKEN_ID,
    proxmoxTokenSecret: process.env.PROXMOX_TOKEN_SECRET,
    pbsTokenId: process.env.PBS_TOKEN_ID,
    pbsTokenSecret: process.env.PBS_TOKEN_SECRET,
    pbsHost: process.env.PBS_HOST,
    
    public: {
      VUPLUS_IP: process.env.VUPLUS_IP,
      ORF1: process.env.ORF1,
    }
  },
  pages: true,
  css: ["vuetify/styles"],
  build: {
    transpile: ["vuetify"],
  },
  vite: {
    plugins: [
      vuetify({
        autoImport: true,
      }),
    ],
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },
});
