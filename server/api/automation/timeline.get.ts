import { loadConfig } from "~/server/utils/config";
import { readPlexCache } from "~/server/utils/plex-cache";
import { parseRecording, ParsedRecording } from "~/utils/plex-recording";
import { ScheduledPeriod } from "~/server/utils/time-utils";

type TimelineWindow = {
  id: string;
  type: "recording" | "scheduled";
  label: string;
  start: string;
  end: string;
};

export default defineEventHandler(async () => {
  const now = new Date();
  const config = loadConfig();

  const windows: TimelineWindow[] = [];
  const recordings: ParsedRecording[] = [];

  /* ------------------------------------------------------------
     Recordings (aus Plex-Cache)
  ------------------------------------------------------------ */

  const plexCache = await readPlexCache();
  const ops = plexCache?.data?.MediaContainer?.MediaGrabOperation ?? [];

  for (const op of ops) {
    const rec = parseRecording(op, config);
    if (!rec) continue;

    recordings.push(rec);

    windows.push({
      id: `rec-${rec.displayTitle}`,
      type: "recording",
      label: rec.displayTitle,
      start: rec.einschaltZeit.toISOString(),
      end: rec.graceAusschaltZeit.toISOString(),
    });
  }

  /* ------------------------------------------------------------
     Timeline-Zeitraum (immer groß genug)
  ------------------------------------------------------------ */

  let rangeStart = new Date(now);
  let rangeEnd = new Date(now);

  if (recordings.length) {
    for (const r of recordings) {
      if (r.einschaltZeit < rangeStart) rangeStart = r.einschaltZeit;
      if (r.graceAusschaltZeit > rangeEnd) rangeEnd = r.graceAusschaltZeit;
    }
  }

  rangeStart = new Date(rangeStart);
  rangeStart.setDate(rangeStart.getDate() - 7);
  rangeStart.setHours(0, 0, 0, 0);

  rangeEnd = new Date(rangeEnd);
  rangeEnd.setDate(rangeEnd.getDate() + 7);
  rangeEnd.setHours(23, 59, 59, 999);

  /* ------------------------------------------------------------
     Scheduled Windows (Config)
  ------------------------------------------------------------ */

  const periods: ScheduledPeriod[] = config.SCHEDULED_ON_PERIODS ?? [];

  for (const p of periods) {
    if (p.enabled === false) continue;

    // DAILY
    if (p.type === "daily") {
      const d = new Date(rangeStart);

      while (d <= rangeEnd) {
        const start = timeOnDate(d, p.start);
        const end = timeOnDate(d, p.end, start);

        windows.push({
          id: `sched-${p.id}-${d.toISOString().slice(0, 10)}`,
          type: "scheduled",
          label: p.label ?? p.id,
          start: start.toISOString(),
          end: end.toISOString(),
        });

        d.setDate(d.getDate() + 1);
      }
    }

    // WEEKLY  ✅ JS-Days 0=So … 6=Sa (wie config + nextOccurrence)
    if (p.type === "weekly" && Array.isArray(p.weekdays)) {
      const d = new Date(rangeStart);

      while (d <= rangeEnd) {
        const day = d.getDay(); // 0=So … 6=Sa

        if (p.weekdays.includes(day)) {
          const start = timeOnDate(d, p.start);
          const end = timeOnDate(d, p.end, start);

          windows.push({
            id: `sched-${p.id}-${d.toISOString().slice(0, 10)}`,
            type: "scheduled",
            label: p.label ?? p.id,
            start: start.toISOString(),
            end: end.toISOString(),
          });
        }

        d.setDate(d.getDate() + 1);
      }
    }

    // ONCE
    if (p.type === "once") {
      const baseDate = new Date(`${p.date}T00:00:00`);

      const start = timeOnDate(baseDate, p.start);
      const end = timeOnDate(baseDate, p.end, start);

      windows.push({
        id: `sched-${p.id}`,
        type: "scheduled",
        label: p.label ?? p.id,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
  }

  /* ------------------------------------------------------------
     Sortieren
  ------------------------------------------------------------ */

  windows.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  recordings.sort(
    (a, b) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime()
  );

  return {
    now: now.toISOString(),
    graceMin: config.GRACE_PERIOD_MIN,
    windows,
    recordings,
  };
});

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function timeOnDate(base: Date, hhmm: string, start?: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);

  // über Mitternacht
  if (start && d <= start) {
    d.setDate(d.getDate() + 1);
  }

  return d;
}
