import { isNasOnlineByPort } from "../../utils/nas-utils"

export default defineEventHandler(async (event) => {
  event.node.res.setHeader("Cache-Control", "no-store")
  
  const online = await isNasOnlineByPort()

  return { ready: online }
})
