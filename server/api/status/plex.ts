export default defineEventHandler(async () => {
  const { plexHost, plexToken } = useRuntimeConfig()
  const url = `${plexHost}/identity?X-Plex-Token=${plexToken}`

  try {
    const res = await $fetch.raw(url, { timeout: 2000 })
    const body = res._data?.toString?.() ?? ""

    // Online: normales Plex-Response
    if (res.status === 200 && body.includes("<MediaContainer")) {
      return {
        online: true,
        url: plexHost
       }
    }

    // Offline: Maintenance-Mode oder andere Responses
    return {
      online: false,
      url: plexHost
    }

  } catch (err) {
    return {
      online: false,
      url: plexHost
    }
  }
})
