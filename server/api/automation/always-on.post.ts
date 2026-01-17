import { setAlwaysOn, saveState } from "../../utils/automation-state";
import { loadConfig } from "../../utils/config";
import { isNasOnlineByPort, NASshellyOnIfNasOff, VUshellyOn } from "../../utils/nas-utils";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const value = body.alwaysOn === true;

  console.log(`[AUTOMATION][ALWAYS-ON] Always-On mode ${value ? "ENABLED" : "DISABLED"}`);

  setAlwaysOn(value);

  // Beim Aktivieren: Geräte sofort einschalten
  if (value) {
    const cfg = loadConfig();
    console.log("[AUTOMATION][ALWAYS-ON] Ensuring all devices are powered on...");

    saveState("STARTING", "START_REQUIRED_DEVICES", "always-on mode enabled");

    const nasOnline = await isNasOnlineByPort();

    if (!nasOnline && cfg.SHELLY?.NAS?.enabled) {
      console.log("[AUTOMATION][ALWAYS-ON] Starting NAS...");
      await NASshellyOnIfNasOff();
    } else if (nasOnline) {
      console.log("[AUTOMATION][ALWAYS-ON] NAS already online");
    }

    if (cfg.SHELLY?.VUPLUS?.enabled) {
      console.log("[AUTOMATION][ALWAYS-ON] Starting VU+...");
      await VUshellyOn();
    }

    console.log("[AUTOMATION][ALWAYS-ON] Plex starts automatically with NAS");

    // State nach Start aktualisieren
    saveState("RUNNING", "KEEP_RUNNING", "always-on mode active");
  }

  return { alwaysOn: value };
});
