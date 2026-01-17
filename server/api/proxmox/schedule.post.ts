import { syncProxmoxBackupOnceWindow } from "../../utils/proxmox-utils"

export default defineEventHandler(async () => {
    try {
      const changed = await syncProxmoxBackupOnceWindow()
      if (changed) {
        console.info("[PROXMOX] auto backup window updated")
        return { ok: true }
      }
    } catch (e) {
      console.error("[PROXMOX] auto backup sync failed", e)
        return { ok: false }
    }
})
