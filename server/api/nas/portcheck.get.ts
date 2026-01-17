import { isNasOnlineByPort } from "../../utils/nas-utils"

export default defineEventHandler(async () => {
  const online = await isNasOnlineByPort()
  return { port22: online }
})
