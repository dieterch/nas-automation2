import { saveConfig } from "../utils/config"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  try {
    saveConfig(body)
    return { ok: true }
  } catch (err) {
    console.error("[CONFIG] save failed", err)
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save configuration",
    })
  }
})
