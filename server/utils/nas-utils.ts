import { exec } from "child_process"
import net from "net"
import util from "util"

const execAsync = util.promisify(exec)

// -----------------------------------------------------------------------------
// KONFIGURATION 
// -----------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getNasEnv() {
  const cfg = useRuntimeConfig()

  return {
    NAS_IP: cfg.NAS_IP,
    NAS_SHELLY_IP: cfg.NAS_SHELLY_IP,
    NAS_SHELLY_RELAY: Number(cfg.NAS_SHELLY_RELAY),
    VUPLUS_SHELLY_IP: cfg.VUPLUS_SHELLY_IP,
    VUPLUS_SHELLY_RELAY: Number(cfg.VUPLUS_SHELLY_RELAY),
    NAS_SSH_USER: cfg.NAS_SSH_USER,
    NAS_SSH_PASS: cfg.NAS_SSH_PASS,
    NAS_SSH_PORT: Number(cfg.NAS_SSH_PORT)
  }
}

// -----------------------------------------------------------------------------
// SHELLIES EIN / AUS
// -----------------------------------------------------------------------------

export async function NASshellyOn() {
  const { NAS_SHELLY_IP, NAS_SHELLY_RELAY } = getNasEnv()
  const url = `http://${NAS_SHELLY_IP}/relay/${NAS_SHELLY_RELAY}?turn=on`
  await fetch(url).catch(() => null)
}

export async function NASshellyOff() {
  const { NAS_SHELLY_IP, NAS_SHELLY_RELAY } = getNasEnv()
  const url = `http://${NAS_SHELLY_IP}/relay/${NAS_SHELLY_RELAY}?turn=off`
  await fetch(url).catch(() => null)
}

export async function VUshellyOn() {
  const { VUPLUS_SHELLY_IP, VUPLUS_SHELLY_RELAY } = getNasEnv()
  const url = `http://${VUPLUS_SHELLY_IP}/relay/${VUPLUS_SHELLY_RELAY}?turn=on`
  await fetch(url).catch(() => null)
}

export async function VUshellyOff() {
  const { VUPLUS_SHELLY_IP, VUPLUS_SHELLY_RELAY } = getNasEnv()
  const url = `http://${VUPLUS_SHELLY_IP}/relay/${VUPLUS_SHELLY_RELAY}?turn=off`
  await fetch(url).catch(() => null)
}

// -----------------------------------------------------------------------------
// NAS-Lauferkennung (Ping oder Portscan)
// -----------------------------------------------------------------------------

export async function isNasRunning(): Promise<boolean> {
  const { NAS_IP } = getNasEnv()
  try {
    await execAsync(`ping -c 1 -W 1 ${NAS_IP}`)
    return true
  } catch {
    return false
  }
}

// Alternative: prüft, ob Port 22 (SSH) offen ist.
export function isNasOnlineByPort(): Promise<boolean> {
  const { NAS_IP, NAS_SSH_PORT } = getNasEnv()
  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(1500)

    socket.on("connect", () => {
      socket.destroy()
      resolve(true)
    })

    socket.on("timeout", () => {
      socket.destroy()
      resolve(false)
    })

    socket.on("error", () => {
      resolve(false)
    })

    socket.connect(NAS_SSH_PORT, NAS_IP)
  })
}

// -----------------------------------------------------------------------------
// SSH-SHUTDOWN – Asustor
// -----------------------------------------------------------------------------

export async function sshShutdown() {
  // ACHTUNG: root login muss erlaubt sein ODER du legst getrennten User an.
  // Alternativ später: SSH-Key einrichten.
  const { NAS_IP, NAS_SSH_PORT, NAS_SSH_USER, NAS_SSH_PASS } = getNasEnv()
  const shutdownCmd = `echo "${NAS_SSH_PASS}" | sudo -S /sbin/poweroff`
  const cmd =
    `sshpass -p "${NAS_SSH_PASS}" ` +
    `ssh -o StrictHostKeyChecking=no -p ${NAS_SSH_PORT} ${NAS_SSH_USER}@${NAS_IP} "${shutdownCmd}"`

  try {
    if (await isNasOnlineByPort()) {
      await execAsync(cmd)
    } else {
      console.log("[NAS-UTILS] NAS SSH port not online.")
    }
  } catch (err) {
    console.error("[NAS-UTILS] SSH poweroff failed:", err)
  }
}

// -----------------------------------------------------------------------------
// NAS BOOT-ERKENNUNG
// -----------------------------------------------------------------------------

export async function waitForNasToBoot(timeoutMs = 60000): Promise<boolean> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const online = await isNasOnlineByPort()
    if (online) return true
    await new Promise(res => setTimeout(res, 2000))
  }

  return false
}

// -----------------------------------------------------------------------------
// NAS kontrolliert neu starten
// -----------------------------------------------------------------------------

// export async function sshReboot() {
//   const { NAS_IP, NAS_SSH_PORT, NAS_SSH_USER, NAS_SSH_PASS } = getNasEnv()
//   const rebootCmd = `echo "${NAS_SSH_PASS}" | sudo -S /sbin/reboot`
//   const cmd =
//     `sshpass -p "${NAS_SSH_PASS}" ` +
//     `ssh -o StrictHostKeyChecking=no -p ${NAS_SSH_PORT} ${NAS_SSH_USER}@${NAS_IP} "${rebootCmd}"`

//   try {
//     await execAsync(cmd)
//   } catch (err) {
//     console.error("[NAS-UTILS] SSH reboot failed:", err)
//   }
// }

// -----------------------------------------------------------------------------
// Statusfunktion für Frontend (optional)
// -----------------------------------------------------------------------------

export async function getNasStatus() {
  const { NAS_IP } = getNasEnv()
  const running = await isNasOnlineByPort()
  return {
    running,
    ip: NAS_IP
  }
}

// -----------------------------------------------------------------------------
// Wait until NAS is finally down
// -----------------------------------------------------------------------------

export async function waitForNasShutdown(timeoutMs = 180_000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const running = await isNasRunning()

    if (!running) {
      console.log("[NAS-UTILS] NAS is now OFF")
      return true
    }

    console.log("[NAS-UTILS] NAS still running … checking again in 20s")
    await sleep(20_000)
  }

  console.log("[NAS-UTILS] NAS did NOT shut down in time")
  return false
}

export async function waitForPlexReady(timeoutMs = 180_000) {
  const runtime = useRuntimeConfig()
  const plexUrl = `${runtime.plexHost}/status/sessions`

  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const result:any = await $fetch(plexUrl, {
        headers: { 
          "X-Plex-Token": runtime.plexToken, 
          "Accept":"application/json" 
        },
        timeout: 2000
      })

      if (result?.MediaContainer) {
        console.log("[NAS-UTILS] Plex is READY")
        return true
      }
    } catch (err) {
      // Plex ist noch nicht bereit
    }

    console.log("[NAS-UTILS] Waiting for Plex API…")
    await sleep(20000)
  }

  console.log("[NAS-UTILS] Plex did NOT get ready in time!")
  return false
}


export async function startNasSafe() {
  await NASshellyOff()
  await sleep(1000)
  await NASshellyOn()

  console.log("[NAS-UTILS] Waiting for NAS to come online…")
  const booted = await waitForNasOnline()

  if (!booted) return false

  console.log("[NAS-UTILS] NAS is online, waiting for Plex to be ready…")
  return await waitForPlexReady()
}


export async function waitForNasOnline(timeoutMs = 120_000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const running = await isNasRunning()

    if (running) return true

    await sleep(5000)
  }

  return false
}

// -----------------------------------------------------------------------------
// SHELLY EIN / AUS, nur wenn NAS OFFLINE
// -----------------------------------------------------------------------------

export async function NASshellyOnIfNasOff() {
  const nasOnline = await isNasOnlineByPort()

  // NAS läuft → kein Einschalten notwendig
  if (nasOnline) {
    console.log("[NAS-UTILS] Shelly: NAS läuft bereits – kein Einschalten.")
    return { success: false, reason: "nas-online" }
  } else {
    console.log("[NAS-UTILS] Shelly: NAS ist offline – Einschalten freigegeben.")
    //await NASshellyOff() // Trigger shelly if NAS off and Shelly already on ...
    //await sleep(1000)
  }

  await NASshellyOn()
  console.log("[NAS-UTILS] Shelly: NAS wurde eingeschaltet.")
  return { success: true }
}

export async function NASshellyOffIfNasOff() {
  const nasOnline = await isNasOnlineByPort()

  // NAS läuft → auf keinen Fall ausschalten!
  if (nasOnline) {
    console.log("[NAS-UTILS] Shelly: NAS ist online – Ausschalten blockiert.")
    return { success: false, reason: "nas-online" }
  } else {
    console.log("[NAS-UTILS] Shelly: NAS ist offline – Ausschalten freigegeben.")
  }

  await NASshellyOff()
  console.log("[NAS-UTILS] Shelly: NAS wurde ausgeschaltet.")
  return { success: true }
}