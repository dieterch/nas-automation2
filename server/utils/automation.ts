import { isVuPlusOn } from "./vuplus-utils";
import { isNasOnlineByPort } from "./nas-utils";
import { loadConfig } from "./config";
import { applyDecision } from "./automation-machine";
import type { Decision } from "./automation-machine";
import { computeAutomationDecision } from "./automation-decision";
import { isNowInScheduledPeriod } from "./time-utils";
import { loadState, saveState } from "./automation-state";
import { ParsedRecording, parseRecording } from "../../utils/plex-recording";

/* ------------------------------------------------------------------
   NIGHT PERIOD
------------------------------------------------------------------ */
function isNowInNightPeriod(
  now: Date,
  night?: { enabled?: boolean; start: string; end: string }
): boolean {
  if (!night?.enabled) return false;

  const [sh, sm] = night.start.split(":").map(Number);
  const [eh, em] = night.end.split(":").map(Number);

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);

  const end = new Date(now);
  end.setHours(eh, em, 0, 0);

  if (end <= start) {
    return now >= start || now <= end;
  }
  return now >= start && now <= end;
}

/* ------------------------------------------------------------------
   MAIN AUTOMATION
------------------------------------------------------------------ */
// export async function runAutomationDryRun(schedule: any) {
export async function runAutomationDryRun() {
  const config = loadConfig();
  const state = loadState()
  const now = new Date();
  const schedule = await readPlexCache();

  // guard if no schedule available
  if (!schedule?.data) {
    saveState(state.state, "NO_ACTION", "no plex cache");
    return {
      ok: false,
      error: "no_schedule_cache",
    };
  }

  const inNightPeriod = isNowInNightPeriod(now, config.NIGHT_PERIOD);
  const [nasOnline, vuOn] = await Promise.all([
    isNasOnlineByPort(),
    isVuPlusOn(),
  ]);

  /* 2) Parse and filter invalid Recordings */
  const raw = schedule?.data?.MediaContainer?.MediaGrabOperation ?? [];
  const recordings = raw
    .map((r: any) => parseRecording(r, config))
    .filter(Boolean) as ParsedRecording[];

  recordings.sort(
    (a, b) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime()
  );

  const decisionResult = computeAutomationDecision(recordings, now, config);
  saveState(state.state, decisionResult.decision, decisionResult.reason);

  switch (decisionResult.decision) {
    case "KEEP_RUNNING": {
      if (!nasOnline || !vuOn) {
        return decide("START_REQUIRED_DEVICES", decisionResult.reason);
      }

      // Geräte laufen → Zustand sauber halten
      return decide("KEEP_RUNNING", decisionResult.reason);
    }

    case "NO_ACTION":
      if (nasOnline && !inNightPeriod) {
        console.log('decide("SHUTDOWN_NAS", "idle (day)");');
        decide("SHUTDOWN_NAS", "idle (day)");
      }
      if (vuOn && inNightPeriod) {
        console.log('decide("SHUTDOWN_ALL, "idle (night);');
        decide("SHUTDOWN_ALL", "idle (night)")
      }
      return decide("NO_ACTION", "idle");
  }

}

/* ------------------------------------------------------------------
   DECISION HOOK
------------------------------------------------------------------ */
function decide(decision: Decision, reason: string) {
  const entry = {
    time: new Date().toISOString(),
    decision,
    reason,
  };

  applyDecision(decision, reason);
  return entry;
}
