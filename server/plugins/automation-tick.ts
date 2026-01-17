// server/plugins/automation-tick.ts

export default defineNitroPlugin(() => {
  const BASE_INTERVAL_MS = 10 * 1000 // fester Basistakt, echte Drosselung passiert im API-Handler

  setInterval(() => {
    // console.log(".")
    // fire & forget – Logik, Config, Throttling liegt serverseitig
    $fetch("/api/automation/tick", { method: "POST" })
    .catch(err => {
      console.error("[AUTOMATION][TICK] failed", err)
    })
  }, BASE_INTERVAL_MS)

  console.log("[AUTOMATION][TICK] started (10s base interval)")
})
