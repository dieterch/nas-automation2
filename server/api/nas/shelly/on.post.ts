import { NASshellyOnIfNasOff } from "../../../utils/nas-utils"

export default defineEventHandler(async () => {
  await NASshellyOnIfNasOff()
  return { ok: true }
})
