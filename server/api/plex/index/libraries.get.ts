import { fetchPlexSafely } from "../../../utils/plex-utils"
import {
  ensurePlexIndexStructure,
  mapLibrary,
  readIndexedLibraries,
  readSyncStatus,
} from "../../../utils/plex-index"

export default defineEventHandler(async () => {
  await ensurePlexIndexStructure()

  const local = await readIndexedLibraries()
  const syncStatus = await readSyncStatus()
  const localMap = new Map(local.items.map((item) => [item.key, item]))
  const syncMap = new Map(syncStatus.libraries.map((item) => [item.libraryKey, item]))

  const live = await fetchPlexSafely("/library/sections")
  if ((live as any)?.error) {
    return {
      online: false,
      items: local.items,
      source: "local",
      syncStatus,
      error: (live as any).message ?? "Plex unavailable",
    }
  }

  const sections = (live as any)?.MediaContainer?.Directory ?? []
  const items = sections
    .filter((section: any) => ["movie", "show"].includes(section.type))
    .map((section: any) => {
      const library = mapLibrary(section, localMap.get(String(section.key)))
      const sync = syncMap.get(String(section.key))
      return {
        ...library,
        sync,
      }
    })

  return {
    online: true,
    source: "live",
    items,
    syncStatus,
  }
})
