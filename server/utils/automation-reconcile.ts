import { loadState, saveState } from "./automation-state";
import { loadConfig } from "./config";
import { readPlexCache } from "./plex-cache";
import { parseRecording, ParsedRecording } from "../../utils/plex-recording";
import { computeAutomationDecision } from "./automation-decision";

export async function reconcileAutomationStateOnStartup() {
  const now = new Date();
  const cfg = loadConfig();
  const persisted = loadState();

  // Plex-Cache lesen (kein Live-Call!)
  const cache = await readPlexCache();
  const raw = cache?.data?.MediaContainer?.MediaGrabOperation ?? [];

  const recordings: ParsedRecording[] = raw
    .map((r: any) => parseRecording(r, cfg))
    .filter(Boolean);

  // neue Entscheidung berechnen
  const result = computeAutomationDecision(recordings, now, cfg);

  // State korrigieren, aber NICHT ausführen
  const reconciledState = {
    state: persisted.state, // DRY_RUN bleibt DRY_RUN
    since: now.toISOString(),
    lastDecision: result.decision,
    reason: result.reason,
  };

  // State korrigieren, aber NICHT ausführen
  saveState(
    persisted.state,     // DRY_RUN / RUNNING bleibt erhalten
    result.decision,     // z. B. NO_ACTION
    result.reason        // z. B. idle
  );

  console.log(
    "[AUTOMATION][RECONCILE]",
    "state =", persisted.state,
    "decision =", result.decision,
    "reason =", result.reason
  );
}
