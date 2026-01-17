import { isNasRunning, waitForPlexReady } from "./nas-utils"

export async function fetchPlexSafely(relativeUrl: string) {
  const cfg = useRuntimeConfig()

  //
  // 1) NAS prüfen
  //
  const nasRunning = await isNasRunning()

  if (!nasRunning) {
    console.log("[Plex] NAS is offline – Plex is not available")
    return {
      error: true,
      offline: true,
      message: "NAS is offline. Plex cannot be reached."
    }
  }

  //
  // 2) Plex bereit?
  //
  const plexReady = await waitForPlexReady()

  if (!plexReady) {
    return {
      error: true,
      plexNotReady: true,
      message: "Plex is running, but not ready yet."
    }
  }

  //
  // 3) Plex API aufrufen
  //
  const fullUrl = `${cfg.plexHost}${relativeUrl}`

  try {
    const result = await $fetch(fullUrl, {
      headers: {
        Accept: "application/json",
        "X-Plex-Token": cfg.plexToken,
        "X-Plex-Product": "NuxtNAS",
        "X-Plex-Version": "1.0",
      }
    })
    return result
  } catch (err: any) {
    return { error: true, message: err.message }
  }
}
