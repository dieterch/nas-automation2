import { readCompletedRecordings } from "../../utils/completed-recordings";

export default defineEventHandler(async () => {
  return await readCompletedRecordings();
});
