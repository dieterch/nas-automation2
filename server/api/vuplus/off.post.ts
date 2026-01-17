import { VUshellyOff } from "../../utils/nas-utils"

export default defineEventHandler(async () => {
  await VUshellyOff()
  return { ok: true }
})
