import { loadConfig, saveConfig } from "~/server/utils/config"
import { MANUAL_WINDOW_ID } from "~/server/utils/manual-window"

export default defineEventHandler(() => {
  const config = loadConfig()

  const now = new Date()
  const today = now.toISOString().slice(0, 10)      // YYYY-MM-DD
  const start = now.toTimeString().slice(0, 5)      // HH:MM

  // idempotent: altes manuelles Fenster entfernen
  config.SCHEDULED_ON_PERIODS =
    config.SCHEDULED_ON_PERIODS.filter(
      p => p.id !== MANUAL_WINDOW_ID
    )

  // neues once-Fenster bis Mitternacht
  config.SCHEDULED_ON_PERIODS.push({
    id: MANUAL_WINDOW_ID,
    active: true,
    type: "once",
    date: today,
    start,
    end: "23:59",
  })

  saveConfig(config)

  return {
    ok: true,
    id: MANUAL_WINDOW_ID,
    from: start,
    to: "23:59",
  }
})
