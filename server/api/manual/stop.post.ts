import { loadConfig, saveConfig } from "~/server/utils/config"
import { MANUAL_WINDOW_ID } from "~/server/utils/manual-window"

export default defineEventHandler(() => {
  const config = loadConfig()

  const before = config.SCHEDULED_ON_PERIODS.length

  config.SCHEDULED_ON_PERIODS =
    config.SCHEDULED_ON_PERIODS.filter(
      p => p.id !== MANUAL_WINDOW_ID
    )

  const removed = before !== config.SCHEDULED_ON_PERIODS.length

  saveConfig(config)

  return {
    ok: true,
    removed,
    id: MANUAL_WINDOW_ID,
  }
})
