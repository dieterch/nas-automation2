export function useNas() {

  async function turnOn() {
    return await $fetch("/api/nas/on", { method: "POST" })
  }

  async function turnOff() {
    return await $fetch("/api/nas/off", { method: "POST" })
  }

  async function status() {
    return await $fetch("/api/nas/status")
  }

  return {
    turnOn,
    turnOff,
    status
  }
}
