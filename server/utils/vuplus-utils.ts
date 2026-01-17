import { getNasEnv } from "./nas-utils"

export async function isVuPlusOn(): Promise<boolean> {
  const { VUPLUS_SHELLY_IP, VUPLUS_SHELLY_RELAY } = getNasEnv()

  try {
    const res: any = await $fetch(
      `http://${VUPLUS_SHELLY_IP}/relay/${VUPLUS_SHELLY_RELAY}`,
      { timeout: 1500 }
    )

    return res?.ison === true
  } catch (err) {
    console.log(err)
    return false
  }
}

export async function waitForVuReady(
  baseUrl: string,
  timeoutMs = 270_000
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/about`, {
        method: "GET",
        cache: "no-store",
      })

      if (res.ok) {
        return
      }
    } catch {
      // ignorieren → Box bootet noch
    }

    await new Promise(r => setTimeout(r, 3000))
  }

  throw new Error("VU+ not ready (timeout)")
}
