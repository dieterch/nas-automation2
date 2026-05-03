import { ensurePlexIndexStructure, readSyncStatus } from "../../../utils/plex-index"

export default defineEventHandler(async () => {
  await ensurePlexIndexStructure()

  return await readSyncStatus()
})
