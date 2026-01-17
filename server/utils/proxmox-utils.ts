import { loadConfig, saveConfig, isOncePeriodExpired } from "./config";

const PRE_MIN = 15;
const POST_MIN = 30;
const FALLBACK_DURATION_MIN = 60;
const FALLBACK_DURATION = 60;

/* ------------------------------------------------------------
   ID / Label aus Quelle ableiten
------------------------------------------------------------ */

type BackupSource = "vzdump" | "pbs-sync";

function buildAutoWindowId(source: BackupSource): string {
  switch (source) {
    case "vzdump":
      return "auto-vzdump-backup-nas";
    case "pbs-sync":
      return "auto-pbs-sync-nas";
    default:
      return "auto-unknown-nas";
  }
}

export async function syncProxmoxBackupOnceWindow(): Promise<boolean> {
  const cfg = loadConfig();
  const now = new Date();

  /* ------------------------------------------------------------
     0. Abgelaufene Auto-Fenster entfernen
        (alle auto-* once Fenster)
  ------------------------------------------------------------ */
  const before = cfg.SCHEDULED_ON_PERIODS.length;

  cfg.SCHEDULED_ON_PERIODS = cfg.SCHEDULED_ON_PERIODS.filter((p: any) => {
    if (
      typeof p.id === "string" &&
      p.id.startsWith("auto-") &&
      p.type === "once" &&
      isOncePeriodExpired(p, now)
    ) {
      return false;
    }
    return true;
  });

  const cleaned = before !== cfg.SCHEDULED_ON_PERIODS.length;
  if (cleaned) {
    console.info("[PROXMOX] expired auto backup window(s) removed");
  }

  if (!cfg.PROXMOX?.enabled) {
    console.info("[PROXMOX] integration disabled");
    return false;
  }

  const runtime = useRuntimeConfig();

  const pveAuth = {
    Authorization: `PVEAPIToken=${runtime.proxmoxTokenId}=${runtime.proxmoxTokenSecret}`,
  };

  const pbsAuth = {
    Authorization: `PBSAPIToken=${runtime.pbsTokenId}:${runtime.pbsTokenSecret}`,
  };

  /* ------------------------------------------------------------
     1. Proxmox vzdump → NAS ?
  ------------------------------------------------------------ */
  const cluster: any = await $fetch(
    `${runtime.proxmoxHost}/api2/json/cluster/backup`,
    { headers: pveAuth, timeout: 5000 }
  );

  const nasVzdumpJob = cluster?.data?.find(
    (j: any) =>
      j.enabled === 1 &&
      j.type === "vzdump" &&
      j.storage === "nas" &&
      j["next-run"]
  );

  /* ------------------------------------------------------------
     2. PBS SyncJob → NAS ?
  ------------------------------------------------------------ */
  const syncCfg: any = await $fetch(
    `${runtime.pbsHost}/api2/json/config/sync`,
    { headers: pbsAuth, timeout: 5000 }
  );

  const nasSyncJob = syncCfg?.data?.find(
    (j: any) => j.store === "backup-nfs" && j.schedule
  );

  if (!nasVzdumpJob && !nasSyncJob) {
    console.info(
      "[PROXMOX] no enabled NAS-related backup jobs found – skipping window"
    );
    return cleaned;
  }

  /* ------------------------------------------------------------
     3. Quelle bestimmen + Startzeit
  ------------------------------------------------------------ */
  let source: BackupSource;
  let nextRunMs: number;

  if (nasVzdumpJob) {
    source = "vzdump";
    nextRunMs = nasVzdumpJob["next-run"] * 1000;
    console.info(
      "[PROXMOX] NAS required by vzdump (next-run=%s)",
      new Date(nextRunMs).toLocaleString()
    );
  } else {
    source = "pbs-sync";
    nextRunMs = parseScheduleToNextRun(nasSyncJob.schedule);
    console.info(
      "[PROXMOX] NAS required by PBS syncjob (schedule=%s)",
      nasSyncJob.schedule
    );
  }

  const autoId = buildAutoWindowId(source);

  /* ------------------------------------------------------------
     4. Dauer ermitteln
  ------------------------------------------------------------ */
  const since = Math.floor((Date.now() - 14 * 86400_000) / 1000);
  let fallbackMs = FALLBACK_DURATION_MIN * 60_000;
  let durationMs = fallbackMs;

  if (source === "vzdump") {
    const tasks: any = await $fetch(
      `${runtime.proxmoxHost}/api2/json/nodes/${runtime.proxmoxNode}/tasks?since=${since}&typefilter=vzdump`,
      { headers: pveAuth, timeout: 5000 }
    );

    const last = tasks?.data?.find((t: any) => t.starttime && t.endtime);
    if (last) durationMs = (last.endtime - last.starttime) * 1000;
  } else {
    const tasks: any = await $fetch(
      `${runtime.pbsHost}/api2/json/nodes/pve/tasks?since=${since}&typefilter=syncjob`,
      { headers: pbsAuth, timeout: 5000 }
    );

    const last = tasks?.data?.find(
      (t: any) =>
        t.starttime && t.endtime && t.worker_id?.includes(nasSyncJob.id)
    );

    if (last) durationMs = (last.endtime - last.starttime) * 1000;

    // obere Schranke setzen
    durationMs = Math.min(durationMs, fallbackMs);
  }

  console.info(
    "[PROXMOX] backup duration=%d min (source=%s)",
    Math.round(durationMs / 60000),
    source
  );

  /* ------------------------------------------------------------
     5. Fenster berechnen
  ------------------------------------------------------------ */
  const startMs = nextRunMs - PRE_MIN * 60_000;
  const endMs = nextRunMs + durationMs + POST_MIN * 60_000;

  const next = {
    id: autoId,
    active: true,
    type: "once",
    date: toDate(startMs),
    start: toTime(startMs),
    end: toTime(endMs),
    label: autoId, // bewusst identisch → Wahrheit überall gleich
  };

  console.info(
    "[PROXMOX] NAS window %s %s–%s (%s)",
    next.date,
    next.start,
    next.end,
    autoId
  );

  /* ------------------------------------------------------------
     6. Idempotent speichern (pro Quelle!)
  ------------------------------------------------------------ */
  const periods = cfg.SCHEDULED_ON_PERIODS ?? [];
  const existing = periods.find((p: any) => p.id === autoId);

  if (existing?.type === "once") {
    const { startMs, endMs } = onceWindowToRange(existing);

    if (now.getTime() >= startMs && now.getTime() < endMs) {
      // 🔒 Active window must not be replaced
      return cleaned; // only return true if we removed expired windows earlier
    }
  }

  const changed =
    !existing ||
    existing.date !== next.date ||
    existing.start !== next.start ||
    existing.end !== next.end;

  if (!changed && !cleaned) return false;

  cfg.SCHEDULED_ON_PERIODS = [
    ...periods.filter((p: any) => p.id !== autoId),
    next,
  ];

  saveConfig(cfg);
  return true;
}

/* ------------------------------------------------------------
   Helpers (lokale Zeit!)
------------------------------------------------------------ */

function toDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function toTime(ms: number) {
  return new Date(ms).toTimeString().slice(0, 5);
}

function onceWindowToRange(p: any): { startMs: number; endMs: number } {
  const start = new Date(`${p.date}T${p.start}:00`).getTime();
  const end = new Date(`${p.date}T${p.end}:00`).getTime();
  return { startMs: start, endMs: end };
}

/* ------------------------------------------------------------
   PBS schedule → next run (HH:mm)
------------------------------------------------------------ */
function parseScheduleToNextRun(schedule: string): number {
  const [h, m] = schedule.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);

  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  return next.getTime();
}
