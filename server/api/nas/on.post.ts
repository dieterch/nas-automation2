import { applyDecision } from "../../utils/automation-machine";

export default defineEventHandler(async () => {
  // Manuelles Einschalten erzwingen
  applyDecision("START_NAS", "manual start via API");

  // 2️⃣ Automation danach neu evaluieren
  await $fetch("/api/automation/tick", { method: "POST" });

  return {
    ok: true,
    action: "START_NAS",
  };
});
