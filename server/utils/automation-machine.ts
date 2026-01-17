import { saveState, loadState, isAlwaysOn } from "./automation-state";
import { logAutomation } from "./automation-log";
import { loadConfig } from "./config";
import { isNasOnlineByPort } from "./nas-utils";

import {
  NASshellyOnIfNasOff,
  NASshellyOffIfNasOff,
  VUshellyOn,
  VUshellyOff,
} from "./nas-utils";

/* ------------------------------------------------------------------
   TYPES
------------------------------------------------------------------ */
export type Decision =
  | "START_REQUIRED_DEVICES"
  | "KEEP_RUNNING"
  | "SHUTDOWN_ALL"
  | "SHUTDOWN_NAS"
  | "NO_ACTION"
  | "ERROR_REQUIRED_DEVICE"
  | "START_NAS"
  | "START_VUPLUS";

async function shutDownNas() {
  const cfg = loadConfig();
  await sshShutdown();

  const res = await waitForNasShutdown();
  if (res) {
    if (cfg.SHELLY?.NAS?.enabled) {
      await NASshellyOffIfNasOff();
    } else {
      console.log("[AUTOMATION-MACHINE] Shelly NAS Off not enabled.");
    }
  } else {
    console.log("[AUTOMATION-MACHINE] Nas failed to Shutdown in 180 sec.");
  }
}

/* ------------------------------------------------------------------
   STATE MACHINE
------------------------------------------------------------------ */
export async function applyDecision(decision: Decision, reason: string) {
  const cfg = loadConfig();
  const state = loadState();
  const actionsEnabled = cfg.AUTOMATION_ACTIONS_ENABLED === true;

  logAutomation({ decision, reason });

  console.log(
    `[AUTOMATION][MACHINE] decision=${decision} reason="${reason}" actionsEnabled=${actionsEnabled} dryRun=${state.dryRun}`
  );

  /* --------------------------------------------------------------
     DRY RUN MODE (kein State-Wechsel!)
  -------------------------------------------------------------- */
  if (state.dryRun === true) {
    console.log(`[AUTOMATION][DRY-RUN] Would execute: ${decision} (${reason})`);
    return;
  }

  /* --------------------------------------------------------------
     ALWAYS-ON MODE (verhindert Ausschalten, erzwingt Einschalten)
  -------------------------------------------------------------- */
  const alwaysOn = isAlwaysOn();

  if (alwaysOn && (decision === "SHUTDOWN_NAS" || decision === "SHUTDOWN_ALL")) {
    console.log(
      `[AUTOMATION][ALWAYS-ON] Shutdown blocked by Always-On mode: ${decision} (${reason})`
    );

    // Sicherstellen, dass alle Geräte eingeschaltet sind
    const nasOnline = await isNasOnlineByPort();

    if (!nasOnline && cfg.SHELLY?.NAS?.enabled) {
      console.log("[AUTOMATION][ALWAYS-ON] Ensuring NAS is on...");
      await NASshellyOnIfNasOff();
    }

    if (cfg.SHELLY?.VUPLUS?.enabled) {
      console.log("[AUTOMATION][ALWAYS-ON] Ensuring VU+ is on...");
      await VUshellyOn();
    }

    // Plex: Startet normalerweise automatisch mit dem NAS
    console.log("[AUTOMATION][ALWAYS-ON] Plex starts automatically with NAS (no separate action)");

    return;
  }

  if (!actionsEnabled) {
    return;
  }

  try {
    switch (decision) {
      /* ---------------- START REQUIRED DEVICES ---------------- */
      case "START_REQUIRED_DEVICES":
        saveState("STARTING", decision, reason);

        const nasOnline = await isNasOnlineByPort();

        if (!nasOnline && cfg.SHELLY?.NAS?.enabled) {
          await NASshellyOnIfNasOff();
        }

        if (cfg.SHELLY?.VUPLUS?.enabled) {
          await VUshellyOn();
        }
        break;

      /* ---------------- KEEP RUNNING ---------------- */
      case "KEEP_RUNNING":
        saveState("RUNNING", decision, reason);
        // KEINE ACTION → korrekt
        break;

      /* ---------------- SHUTDOWN NAS (DAY) ---------------- */
      case "SHUTDOWN_NAS": {
        const nasOnline = await isNasOnlineByPort();

        if (!nasOnline) {
          // 👉 HIER ist der fehlende Exit
          saveState("IDLE", "NO_ACTION", "nas already off");
          return;
        }

        saveState("SHUTTING_DOWN", decision, reason);
        await shutDownNas();
        saveState("IDLE", decision, "nas shut down");
        break;
      }

      /* ---------------- SHUTDOWN ALL (NIGHT) ---------------- */
      case "SHUTDOWN_ALL":
        saveState("SHUTTING_DOWN", decision, reason);

        if (cfg.SHELLY?.VUPLUS?.enabled) {
          await VUshellyOff();
        }

        await shutDownNas();
        saveState("IDLE", decision, "all devices shut down");
        break;

      /* ---------------- NO ACTION ---------------- */
      case "NO_ACTION":
        // bewusst nichts tun
        break;

      /* ---------------- ERROR ---------------- */
      case "ERROR_REQUIRED_DEVICE":
      default:
        saveState("ERROR", decision, reason);
        break;
    }
  } catch (err) {
    console.error("[AUTOMATION][MACHINE] action failed", err);
    saveState(
      "ERROR",
      "ERROR_REQUIRED_DEVICE",
      "exception during automation action"
    );
  }
}
