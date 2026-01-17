import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"

/* ------------------------------------------------------------------
   Paths
------------------------------------------------------------------ */
const CONFIG_FILE = resolve("data/configuration.json")
const BACKUP_FILE = resolve("data/configuration.json.bak")

/* ------------------------------------------------------------------
   Types (minimal, bewusst locker)
------------------------------------------------------------------ */
type ScheduledPeriod = {
  _uid?: string
  [key: string]: unknown
}

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
function stripUiFields(cfg: any) {
  if (Array.isArray(cfg?.SCHEDULED_ON_PERIODS)) {
    cfg.SCHEDULED_ON_PERIODS = cfg.SCHEDULED_ON_PERIODS
      .map(({ _uid, ...rest }: any) => rest)
      .sort((a:any, b:any) => nextOccurrence(a) - nextOccurrence(b))
  }
  return cfg
}




/* ------------------------------------------------------------------
   Validation
------------------------------------------------------------------ */
export function validateConfig(cfg: any) {
  const errors: string[] = []

  if (!Number.isInteger(cfg.TICK_INTERVAL_SEC) || cfg.TICK_INTERVAL_SEC < 5) {
    errors.push("TICK_INTERVAL_SEC invalid")
  }

  if (
    !Number.isInteger(cfg.REC_SCHEDULE_INTERVALL) ||
    cfg.REC_SCHEDULE_INTERVALL < 30
  ) {
    errors.push("REC_SCHEDULE_INTERVALL invalid")
  }

  if (!Array.isArray(cfg.SCHEDULED_ON_PERIODS)) {
    errors.push("SCHEDULED_ON_PERIODS missing or invalid")
  }

  if (cfg.NIGHT_PERIOD?.enabled) {
    if (!/^\d{2}:\d{2}$/.test(cfg.NIGHT_PERIOD.start)) {
      errors.push("NIGHT_PERIOD.start invalid")
    }
    if (!/^\d{2}:\d{2}$/.test(cfg.NIGHT_PERIOD.end)) {
      errors.push("NIGHT_PERIOD.end invalid")
    }
  }

  if (errors.length) {
    console.error("[CONFIG] invalid configuration", errors)
    throw new Error("Invalid configuration: " + errors.join(", "))
  }

  return cfg
}

/* ------------------------------------------------------------------
   Load
------------------------------------------------------------------ */
export function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"))
  return validateConfig(raw)
}

/* ------------------------------------------------------------------
   Save (inkl. Backup + Strip UI Fields)
------------------------------------------------------------------ */
export function saveConfig(rawConfig: any) {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error("Invalid config payload")
  }

  // Backup (best effort)
  try {
    const current = loadConfig()
    writeFileSync(BACKUP_FILE, JSON.stringify(current, null, 2), "utf-8")
  } catch {
    /* ignore backup errors */
  }

  // Clone → UI-Felder entfernen → validieren → schreiben
  const cleanConfig = validateConfig(
    stripUiFields(structuredClone(rawConfig))
  )

  writeFileSync(
    CONFIG_FILE,
    JSON.stringify(cleanConfig, null, 2),
    "utf-8"
  )
}

function nextOccurrence(p: any, now = new Date()): number {
  if (!p?.active) return Number.MAX_SAFE_INTEGER

  const [h, m] = p.start.split(":").map(Number)

  // once
  if (p.type === "once" && p.date) {
    const d = new Date(`${p.date}T${p.start}:00`)
    return d.getTime()
  }

  // daily
  if (p.type === "daily") {
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    if (d <= now) d.setDate(d.getDate() + 1)
    return d.getTime()
  }

  // weekly
  if (p.type === "weekly" && Array.isArray(p.weekdays)) {
    const times = p.weekdays.map((wd: number) => {
      const d = new Date(now)
      const delta = (wd - d.getDay() + 7) % 7
      d.setDate(d.getDate() + delta)
      d.setHours(h, m, 0, 0)
      if (d <= now) d.setDate(d.getDate() + 7)
      return d.getTime()
    })
    return Math.min(...times)
  }

  return Number.MAX_SAFE_INTEGER
}

// export function isOncePeriodExpired(p: any, now = new Date()): boolean {
//   if (p.type !== "once" || !p.date || !p.end) return false

//   const end = new Date(`${p.date}T${p.end}:00`)
//   return end.getTime() < now.getTime()
// }

const ONCE_EXPIRE_GRACE_MS = 60_000; // 1 minute (tune if needed)

export function isOncePeriodExpired(
  p: any,
  now = new Date()
): boolean {
  if (p.type !== "once" || !p.date || !p.end) return false;
  const end = new Date(`${p.date}T${p.end}:00`).getTime();
  return now.getTime() > end + ONCE_EXPIRE_GRACE_MS;
}
