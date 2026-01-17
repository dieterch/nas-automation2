// server/api/automation/tick.post.ts

import { loadConfig } from "../../utils/config";
import { loadState, saveState } from "../../utils/automation-state";
// import { readPlexCache } from "../../utils/plex-cache";
import { runAutomationDryRun } from "../../utils/automation";
import { consoleError } from "vuetify/lib/util/console.mjs";

import { writeFileSync } from "fs";
import { resolve } from "path";

const STATE_FILE = resolve("data/automation-state.json");

function updateLastTick() {
  const state = loadState();
  state.lastTickAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export default defineEventHandler(async () => {
  const cfg = loadConfig();
  const state = loadState();

  const now = Date.now();
  const lastTick = state.lastTickAt ? Date.parse(state.lastTickAt) : 0;

  const intervalMs = (cfg.TICK_INTERVAL_SEC ?? 60) * 1000;

  if (now - lastTick < intervalMs) {
    return {
      ok: true,
      skipped: true,
      reason: "tick throttled",
      nextInSec: Math.ceil((intervalMs - (now - lastTick)) / 1000),
    };
  }

  // ✅ Tick akzeptiert
  updateLastTick();

  const result: any = await runAutomationDryRun();

  return {
    ok: true,
    decision: result.decision,
    reason: result.reason,
    time: result.time,
  };
});
