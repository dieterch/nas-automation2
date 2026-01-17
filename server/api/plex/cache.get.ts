import { readPlexCache } from "../../utils/plex-cache";

export default defineEventHandler(async () => {
  return await readPlexCache();
});
