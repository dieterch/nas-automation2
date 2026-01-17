import { loadState } from "../../utils/automation-state";
import { loadConfig } from "../../utils/config";
import { ParsedRecording, parseRecording } from "../../../utils/plex-recording";
import { readPlexCache } from "../../utils/plex-cache";
import type { ScheduledPeriod } from "../../utils/time-utils";
import { isNowInScheduledPeriod } from "../../utils/time-utils";

type ScheduledPeriodWithStart = ScheduledPeriod & {
  startDate: Date;
};

export default defineEventHandler(async () => {
  const now = new Date();
  const state = loadState();
  const config = loadConfig();

  /* ------------------------------------------------------------------
   RECORDINGS
  ------------------------------------------------------------------ */
  const schedule = await readPlexCache();
  const raw = schedule?.data?.MediaContainer?.MediaGrabOperation ?? [];
  const recordings = raw
    .map((r: any) => parseRecording(r, config))
    .filter(Boolean) as ParsedRecording[];

  recordings.sort(
    (a, b) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime()
  );

  const runningRecordings = recordings.filter(
    (r) => r.einschaltZeit <= now && r.graceAusschaltZeit > now
  );

  const nextRecording = recordings.find((r) => r.einschaltZeit > now) ?? null;

  /* ------------------------------------------------------------------
   ZEITFENSTER
  ------------------------------------------------------------------ */
  const scheduledCheck = isNowInScheduledPeriod(
    now,
    config.SCHEDULED_ON_PERIODS
  );

  const activeWindow: ScheduledPeriod | null = scheduledCheck.active
    ? (config.SCHEDULED_ON_PERIODS as ScheduledPeriod[]).find((w) => {
        const start = computeStartTimestampLocal(w);
        const end = computeEndTimestampLocal(w);
        return now >= start && now <= end;
      }) ?? null
    : null;

  const activeWindows: ScheduledPeriod[] | null = scheduledCheck.active
    ? (config.SCHEDULED_ON_PERIODS as ScheduledPeriod[]).filter((w) => {
        const start = computeStartTimestampLocal(w);
        const end = computeEndTimestampLocal(w);
        return now >= start && now <= end;
      }) ?? null
    : null;

  const nextWindow: ScheduledPeriodWithStart | null =
    (config.SCHEDULED_ON_PERIODS as ScheduledPeriod[])
      .map((w): ScheduledPeriodWithStart => ({
        ...w,
        startDate: computeStartTimestampLocal(w),
      }))
      .filter((w) => w.startDate.getTime() > now.getTime())[0] ?? null;

  return {
    now,
    automation: {
      state: mapVariant(state.state),
      since: state.since,
      sinceHuman: state.since
        ? human(now.getTime() - new Date(state.since).getTime())
        : null,
    },
    counts: {
      recordingsUpcoming: recordings.filter((r) => r.einschaltZeit > now)
        .length,
      recordingsRunning: runningRecordings.length,
      windowsTotal: config.SCHEDULED_ON_PERIODS?.length ?? 0,
      windowsActive: activeWindow ? 1 : 0,
    },
    runningRecordings: runningRecordings || null,
    activeWindows,
    next: {
      recording: nextRecording
        ? {
            title: nextRecording.displayTitle,
            at: nextRecording.einschaltZeit,
            inHuman: human(
              nextRecording.einschaltZeit.getTime() - now.getTime()
            ),
          }
        : null,
      window: nextWindow
        ? {
            title: nextWindow.label ?? nextWindow.id,
            at: nextWindow.startDate,
            inHuman: human(
              nextWindow.startDate.getTime() - now.getTime()
            ),
          }
        : null,
    },
  };
});

/* ------------------------------------------------------------------
   ZEITBERECHNUNG – LOKAL, DATE-BASED
------------------------------------------------------------------ */

export function computeStartTimestampLocal(period: ScheduledPeriod): Date {
  const now = new Date();

  function buildLocalDate(date: Date, time: string): Date {
    const [h, m] = time.split(":").map(Number);
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      h,
      m,
      0,
      0
    );
  }

  if (period.type === "once") {
    const [y, m, d] = period.date.split("-").map(Number);
    return buildLocalDate(new Date(y, m - 1, d), period.start);
  }

  if (period.type === "weekly" && period.weekdays?.length) {
    const today = now.getDay();
    const sorted = [...period.weekdays].sort((a, b) => a - b);
    let target = sorted.find((d) => d >= today) ?? sorted[0];
    let offset = target - today;
    if (offset < 0) offset += 7;

    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    return buildLocalDate(date, period.start);
  }

  return buildLocalDate(now, period.start);
}

export function computeEndTimestampLocal(period: ScheduledPeriod): Date {
  const now = new Date();

  function buildLocalDate(date: Date, time: string): Date {
    const [h, m] = time.split(":").map(Number);
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      h,
      m,
      0,
      0
    );
  }

  if (period.type === "once") {
    const [y, m, d] = period.date.split("-").map(Number);
    return buildLocalDate(new Date(y, m - 1, d), period.end);
  }

  if (period.type === "weekly" && period.weekdays?.length) {
    const today = now.getDay();
    const sorted = [...period.weekdays].sort((a, b) => a - b);
    let target = sorted.find((d) => d >= today) ?? sorted[0];
    let offset = target - today;
    if (offset < 0) offset += 7;

    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    return buildLocalDate(date, period.end);
  }

  return buildLocalDate(now, period.end);
}

/* ------------------------------------------------------------------ */

function human(ms: number) {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function mapVariant(state: string) {
  switch (state) {
    case "IDLE":
      return "OFF";
    case "RUNNING":
      return "ON";
    default:
      return state;
  }
}
