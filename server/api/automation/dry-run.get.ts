import { isDryRun } from "../../utils/automation-state";

export default defineEventHandler(() => {
  return { dryRun: isDryRun() };
});
