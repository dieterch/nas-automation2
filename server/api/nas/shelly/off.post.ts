import { NASshellyOffIfNasOff } from "../../../utils/nas-utils"

export default defineEventHandler(async () => {
  await NASshellyOffIfNasOff()
  return { ok: true }
})
