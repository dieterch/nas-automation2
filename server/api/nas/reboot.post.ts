import { applyDecision } from "../../utils/automation-machine";

export default defineEventHandler(async () => {
  // Reboot = kontrollierter Shutdown + Start
  applyDecision("SHUTDOWN_NAS", "manual reboot via API");
  applyDecision("START_NAS", "manual reboot via API");

  // 2️⃣ Automation danach neu evaluieren
  await $fetch("/api/automation/tick", { method: "POST" });

  return {
    ok: true,
    action: "REBOOT_NAS",
  };
});
