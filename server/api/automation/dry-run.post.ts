import { setDryRun } from "../../utils/automation-state";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const value = body.dryRun === true;
  setDryRun(value);
  return { dryRun: value };
});
