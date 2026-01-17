export default defineEventHandler(() => {
  try {
    return loadConfig()
  } catch (err) {
    console.error("[CONFIG] load failed", err)
    throw createError({
      statusCode: 500,
      statusMessage: "Configuration invalid",
    })
  }
})
