import { loadState, saveState } from "../../utils/automation-state";
import { loadConfig } from "../../utils/config";
import { readPlexCache } from "../../utils/plex-cache";
import type { ScheduledPeriod } from "../../utils/time-utils";
import { isNowInScheduledPeriod } from "../../utils/time-utils";
import { ParsedRecording, parseRecording } from "../../../utils/plex-recording";

type ScheduledPeriodWithStart = ScheduledPeriod & {
  startDate: string;
};

export default defineEventHandler(async () => {
  const now = new Date();
  const state = loadState();
  const config = loadConfig();

  /* ------------------------------------------------------------
     Scheduled windows
  ------------------------------------------------------------ */

  const scheduledCheck = isNowInScheduledPeriod(
    now,
    config.SCHEDULED_ON_PERIODS
  );

  const activeWindow: ScheduledPeriod | null = scheduledCheck.active
    ? (config.SCHEDULED_ON_PERIODS as ScheduledPeriod[]).find((w) => {
        const start = computeStartTimestampLocal(w);
        const end = computeEndTimestampLocal(w);
        return now >= new Date(start) && now <= new Date(end);
      }) ?? null
    : null;

  const nextWindow: ScheduledPeriodWithStart | null =
    (config.SCHEDULED_ON_PERIODS as ScheduledPeriod[])
      .map((w) => ({
        ...w,
        startDate: computeStartTimestampLocal(w),
      }))
      .filter((w) => new Date(w.startDate) > now)[0] ?? null;

  /* ------------------------------------------------------------
     Recordings
  ------------------------------------------------------------ */

  const cache = await readPlexCache();
  const raw: unknown[] = cache?.data?.MediaContainer?.MediaGrabOperation ?? [];

  const recordings: ParsedRecording[] = raw
    .map((r) => parseRecording(r, config))
    .filter((r): r is ParsedRecording => Boolean(r))
    .sort((a, b) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime());

  const runningRecordings = recordings.filter(
    (r) => r.aufnahmeStart <= now && r.aufnahmeEnde > now
  );

  const nextRecording = recordings.find((r) => r.einschaltZeit > now) ?? null;

  /* ------------------------------------------------------------
     LAST EVENTS – state-only detection (no automation rewrite)
  ------------------------------------------------------------ */

  // ---- Window ----
  if (activeWindow) {
    if (!state.last.window) {
      state.last.window = {
        id: activeWindow.id,
        label: activeWindow.label ?? activeWindow.id,
        startedAt: now.toISOString(),
        endedAt: "",
        source: "auto",
      };
    }
  } else if (state.last.window && !state.last.window.endedAt) {
    state.last.window.endedAt = now.toISOString();
  }

  // ---- Recording ----
  if (runningRecordings.length > 0) {
    if (!state.last.recording) {
      const r = runningRecordings[0];
      state.last.recording = {
        title: r.displayTitle,
        startedAt: r.aufnahmeStart.toISOString(),
        endedAt: "",
        result: "success",
      };
    }
  } else if (state.last.recording && !state.last.recording.endedAt) {
    state.last.recording.endedAt = now.toISOString();
    state.last.recording.result = "success";
  }

  // persist state.last updates
  saveState(state.state, state.lastDecision ?? "STATUS", state.reason ?? "");

  /* ------------------------------------------------------------
     Next automation-relevant event
  ------------------------------------------------------------ */

  let nextAutomationEvent:
    | { type: "IDLE" }
    | { type: "WINDOW_ACTIVE"; id: string; label: string }
    | {
        type: "WINDOW_START";
        id: string;
        label: string;
        at: Date;
        inHuman: string;
      }
    | {
        type: "RECORDING_START";
        title: string;
        at: Date;
        inHuman: string;
      } = { type: "IDLE" };

  if (activeWindow) {
    nextAutomationEvent = {
      type: "WINDOW_ACTIVE",
      id: activeWindow.id,
      label: activeWindow.label ?? activeWindow.id,
    };
  } else if (nextWindow) {
    nextAutomationEvent = {
      type: "WINDOW_START",
      id: nextWindow.id,
      label: nextWindow.label ?? nextWindow.id,
      at: new Date(nextWindow.startDate),
      inHuman: human(
        new Date(nextWindow.startDate).getTime() - now.getTime()
      ),
    };
  } else if (nextRecording) {
    nextAutomationEvent = {
      type: "RECORDING_START",
      title: nextRecording.displayTitle,
      at: nextRecording.einschaltZeit,
      inHuman: human(
        nextRecording.einschaltZeit.getTime() - now.getTime()
      ),
    };
  }

  /* ------------------------------------------------------------
     Why
  ------------------------------------------------------------ */

  const why = activeWindow
    ? {
        active: true,
        reasons: [
          `Zeitfenster: ${
            activeWindow.label ?? activeWindow.id
          } | ${activeWindow.start} - ${activeWindow.end}`,
        ],
      }
    : runningRecordings.length > 0
    ? {
        active: true,
        reasons: runningRecordings.map((r) => `Recording: ${r.displayTitle}`),
      }
    : { active: false };

  return {
    automation: {
      state: state.state,
      since: state.since,
      sinceHuman: state.since
        ? human(now.getTime() - new Date(state.since).getTime())
        : null,
      uiVariant: mapVariant(state.state),
    },

    activeWindow,

    counts: {
      recordingsUpcoming: recordings.filter((r) => r.einschaltZeit > now).length,
      recordingsRunning: runningRecordings.length,
      windowsTotal: config.SCHEDULED_ON_PERIODS?.length ?? 0,
      windowsActive: activeWindow ? 1 : 0,
    },

    next: {
      window: nextWindow
        ? {
            id: nextWindow.id,
            label: nextWindow.label ?? nextWindow.id,
            at: new Date(nextWindow.startDate),
            inHuman: human(
              new Date(nextWindow.startDate).getTime() - now.getTime()
            ),
          }
        : null,
      recording: nextRecording
        ? {
            title: nextRecording.displayTitle,
            at: nextRecording.einschaltZeit,
            inHuman: human(
              nextRecording.einschaltZeit.getTime() - now.getTime()
            ),
          }
        : null,
      automation: nextAutomationEvent,
    },

    last: state.last ?? null,
    why,
  };
});

/* ------------------------------------------------------------ */

function mapVariant(state: string) {
  switch (state) {
    case "KEEP_RUNNING":
      return "success";
    case "START_REQUIRED_DEVICES":
      return "warning";
    case "SHUTDOWN_ALL":
    case "SHUTDOWN_NAS":
      return "error";
    default:
      return "info";
  }
}

function human(ms: number) {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export function computeStartTimestampLocal(period: ScheduledPeriod): string {
  const now = new Date();

  function buildLocalISO(date: Date, start: string): string {
    const [h, m] = start.split(":").map(Number);
    const d = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      h,
      m,
      0,
      0
    );
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  if (period.type === "once") {
    const [y, m, d] = period.date.split("-").map(Number);
    return buildLocalISO(new Date(y, m - 1, d), period.start);
  }

  if (period.type === "weekly" && period.weekdays?.length) {
    const today = now.getDay();
    const sorted = [...period.weekdays].sort((a, b) => a - b);
    let target = sorted.find((d) => d >= today) ?? sorted[0];
    let offset = target - today;
    if (offset < 0) offset += 7;
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    return buildLocalISO(date, period.start);
  }

  return buildLocalISO(now, period.start);
}

export function computeEndTimestampLocal(period: ScheduledPeriod): string {
  const now = new Date();

  function buildLocalISO(date: Date, end: string): string {
    const [h, m] = end.split(":").map(Number);
    const d = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      h,
      m,
      0,
      0
    );
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  if (period.type === "once") {
    const [y, m, d] = period.date.split("-").map(Number);
    return buildLocalISO(new Date(y, m - 1, d), period.end);
  }

  if (period.type === "weekly" && period.weekdays?.length) {
    const today = now.getDay();
    const sorted = [...period.weekdays].sort((a, b) => a - b);
    let target = sorted.find((d) => d >= today) ?? sorted[0];
    let offset = target - today;
    if (offset < 0) offset += 7;
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    return buildLocalISO(date, period.end);
  }

  return buildLocalISO(now, period.end);
}
