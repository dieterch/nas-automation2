/* ******************************************
schaufelt alle REC_SCHEDULE_INTERVAL Sekunden
die Aufnahmen vom plex-API in den cache
******************************************* */
import { loadConfig } from "~/server/utils/config"
import { isNasOnlineByPort } from "~/server/utils/nas-utils"

export default defineNitroPlugin(() => {
  const config = loadConfig()

  const intervalSec = config.REC_SCHEDULE_INTERVALL ?? 300
  const intervalMs = intervalSec * 1000

  setInterval(async () => {
    try {
      const nasOnline = await isNasOnlineByPort()
      if (!nasOnline) return

      await $fetch("/api/plex/scheduled-refresh")
    } catch {
      // absichtlich leer
    }
  }, intervalMs)
})
