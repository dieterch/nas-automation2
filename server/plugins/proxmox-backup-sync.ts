export default defineNitroPlugin(() => {
  const cfg = loadConfig()
  const interval = (cfg.REC_SCHEDULE_INTERVALL ?? 300) * 1000

  setInterval(async () => {
    try {
      const changed = await syncProxmoxBackupOnceWindow()
      if (changed) {
        console.info("[PROXMOX] auto backup window updated")
      }
    } catch (e) {
      console.error("[PROXMOX] auto backup sync failed", e)
    }
  }, interval)
})
