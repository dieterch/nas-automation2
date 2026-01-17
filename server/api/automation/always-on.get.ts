import { isAlwaysOn } from "../../utils/automation-state";

export default defineEventHandler(() => {
  return { alwaysOn: isAlwaysOn() };
});
