import { isVuPlusOn } from "../../utils/vuplus-utils"

export default defineEventHandler(async () => {
  const on = await isVuPlusOn()

  return {
    on,
  }
})
