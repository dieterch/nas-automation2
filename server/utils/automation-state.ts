import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const STATE_FILE = resolve("data/automation-state.json");

export type AutomationState =
  | "INIT"
  | "IDLE"
  | "DRY_RUN"
  | "STARTING"
  | "RUNNING"
  | "NAS_OFF"
  | "SHUTTING_DOWN"
  | "ERROR";

export interface AutomationStateFile {
  state: AutomationState;
  lastTickAt: string;
  since: string;
  lastDecision?: string;
  reason?: string;
  last: {
    window?: {
      id: string;
      label: string;
      startedAt: string;
      endedAt: string;
      source: "auto" | "manual";
    };
    recording?: {
      title: string;
      startedAt: string;
      endedAt: string;
      result: "success" | "aborted" | "error";
    };
  };
}

/* ------------------------------------------------------------
   Load
------------------------------------------------------------ */

// export function loadState(): AutomationStateFile {
//   const now = new Date().toISOString();

//   if (!existsSync(STATE_FILE)) {
//     return {
//       state: "IDLE",
//       since: now,
//       lastTickAt: now,
//       last: {}, // ← wichtig für den Typ
//     };
//   }

//   const parsed = JSON.parse(
//     readFileSync(STATE_FILE, "utf-8")
//   ) as Partial<AutomationStateFile>;

//   return {
//     state: parsed.state ?? "IDLE",
//     since: parsed.since ?? now,
//     lastTickAt: parsed.lastTickAt ?? now,
//     lastDecision: parsed.lastDecision,
//     reason: parsed.reason,
//     last: parsed.last ?? {}, // ← Rückwärtskompatibel
//   };
// }

export function loadState(): AutomationStateFile {
  const now = new Date().toISOString();

  if (!existsSync(STATE_FILE)) {
    const initial: AutomationStateFile = {
      state: "INIT",
      since: now,
      lastTickAt: "1970-01-01T00:00:00.000Z", // wichtig!
      last: {},
    };

    writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

/* ------------------------------------------------------------
   Save (State-Übergang)
------------------------------------------------------------ */

// export function saveState(
//   newState: AutomationState,
//   decision: string,
//   reason: string
// ) {
//   const prev = loadState();
//   const now = new Date().toISOString();

//   const entry: AutomationStateFile = {
//     state: newState,
//     lastTickAt: now,
//     since: prev.state === newState ? prev.since : now,
//     lastDecision: decision,
//     reason,
//     last: prev.last ?? {}, // ← NICHT zerstören
//   };

//   writeFileSync(STATE_FILE, JSON.stringify(entry, null, 2));
// }

export function saveState(
  newState: AutomationState,
  decision: string,
  reason: string
) {
  const prev = loadState();
  const now = new Date().toISOString();

  const entry: AutomationStateFile = {
    ...prev,
    state: newState,
    since: prev.state === newState ? prev.since : now,
    lastDecision: decision,
    reason,
    // ❌ lastTickAt hier NICHT anfassen
  };

  writeFileSync(STATE_FILE, JSON.stringify(entry, null, 2));
}


/* ------------------------------------------------------------
   Setters für letzte Ereignisse
------------------------------------------------------------ */

export function setLastWindow(event: {
  id: string;
  label: string;
  startedAt: string;
  endedAt: string;
  source: "auto" | "manual";
}) {
  const state = loadState();

  state.last.window = event;

  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function setLastRecording(event: {
  title: string;
  startedAt: string;
  endedAt: string;
  result: "success" | "aborted" | "error";
}) {
  const state = loadState();

  state.last.recording = event;

  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
