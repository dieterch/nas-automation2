import { waitForVuReady } from "../../utils/vuplus-utils"
//import { applyDecision } from "../../utils/automation-machine";

export default defineEventHandler(async () => {

  const { VUPLUS_IP, ORF1 } = useRuntimeConfig()

  await VUshellyOn()
  // await waitForVuReady('http://${VUPLUS_IP}')
  // await $fetch(`http://${VUPLUS_IP}/api/zap?sRef=${ORF1}`)
  return { ok: true }
})
