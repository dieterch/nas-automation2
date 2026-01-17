import { isNowInScheduledPeriod } from "./time-utils";
import {
  ParsedRecording,
  parseRecording,
} from "./../../utils/plex-recording";

export function computeAutomationDecision(
  recordings: ParsedRecording[],
  now: Date,
  cfg: any
) {
  /* ------------------------------------------------------------
     1. Scheduled ON (harte Übersteuerung)
  ------------------------------------------------------------ */
  const forced = isNowInScheduledPeriod(now, cfg.SCHEDULED_ON_PERIODS);
  if (forced.active) {
    return {
      decision: "KEEP_RUNNING",
      reason: forced.reason ?? "scheduled on window",
    };
  }

  /* ------------------------------------------------------------
     2. Aufnahme-Zeitfenster inkl. Grace-Ausschaltzeit
        [einschaltZeit ... graceAusschaltZeit]
  ------------------------------------------------------------ */

  if (
    recordings.some(
      (r) =>
        now >= r.einschaltZeit &&
        now < r.graceAusschaltZeit
    )
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "recording or grace after recording",
    };
  }

  /* ------------------------------------------------------------
     3. Sonst: OFF
  ------------------------------------------------------------ */
  return {
    decision: "NO_ACTION",
    reason: "idle",
  };
}
