import { applyDecision } from "../../utils/automation-machine";

export default defineEventHandler(async () => {
  // Manuelles Abschalten erzwingen
  applyDecision("SHUTDOWN_NAS", "manual shutdown via API");

  // 2️⃣ Automation danach neu evaluieren
  await $fetch("/api/automation/tick", { method: "POST" });

  return {
    ok: true,
    action: "SHUTDOWN_NAS",
  };
});
