import { getNasStatus } from "../../utils/nas-utils"

export default defineEventHandler(async () => {
  return await getNasStatus()
})
