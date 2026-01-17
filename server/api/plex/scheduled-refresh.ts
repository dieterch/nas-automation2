import { loadConfig } from "~/server/utils/config";
import { readPlexCache, writePlexCache } from "~/server/utils/plex-cache";
import { isNasOnlineByPort } from "~/server/utils/nas-utils";
import { fetchPlexSafely } from "~/server/utils/plex-utils";
import {
  ParsedRecording,
  parseRecording,
} from "~/utils/plex-recording";

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function extractSchedules(data: any): any[] {
  return data?.MediaContainer?.MediaGrabOperation ?? [];
}

function isValidPlexSchedulePayload(data: any): boolean {
  const mc = data?.MediaContainer;
  if (!mc) return false;

  // Plex antwortet, aber ist noch nicht "bereit"
  if (!Array.isArray(mc.MediaGrabOperation)) return false;

  // explizit leer → potentiell Startup-Zustand
  if (mc.MediaGrabOperation.length === 0) return false;

  // erste Aufnahme plausibel prüfen
  const first = mc.MediaGrabOperation[0];
  if (!first?.Metadata?.Media?.[0]?.beginsAt) return false;

  return true;
}

/**
 * Zählt alle AUFNAHMEN, die für die Automation noch relevant sind:
 * - zukünftig
 * - laufend
 * - Nachlauf aktiv
 */
function countRelevantRecordings(
  ops: any[],
  config: any,
  now: Date
): number {
  return ops.reduce((count, op) => {
    const parsed: ParsedRecording | null = parseRecording(op, config);
    if (!parsed) return count;

    return now < parsed.ausschaltZeit ? count + 1 : count;
  }, 0);
}

/**
 * Guard:
 * Verhindert, dass ein leerer / instabiler Plex-Response
 * einen noch gültigen Cache überschreibt.
 */
async function shouldUpdateCache(
  newData: any,
  existingCache: any,
  config: any
): Promise<boolean> {
  if (!existingCache?.data) return true;

  const now = new Date();

  const newOps = extractSchedules(newData);
  const oldOps = extractSchedules(existingCache.data);

  const newRelevant = countRelevantRecordings(newOps, config, now);
  const oldRelevant = countRelevantRecordings(oldOps, config, now);

  // Plex noch nicht bereit → Cache behalten
  if (newRelevant === 0 && oldRelevant > 0) {
    return false;
  }

  return true;
}

/**
 * Entfernt nur wirklich erledigte Aufnahmen
 * (graceausschaltzeit < now)
 */
function sanitizePlexPayload(data: any, config: any): any {
  const mc = data?.MediaContainer;
  if (!mc?.MediaGrabOperation) return data;

  const now = new Date();

  mc.MediaGrabOperation = mc.MediaGrabOperation.filter((op: any) => {
    const parsed: ParsedRecording | null = parseRecording(op, config);
    if (!parsed) return false;

    return now < parsed.graceAusschaltZeit;
  });

  return data;
}

/* ------------------------------------------------------------
   Handler
------------------------------------------------------------ */

export default defineEventHandler(async () => {
  const config = loadConfig();

  const nasOnline = await isNasOnlineByPort();
  if (!nasOnline) {
    return { updated: false, reason: "NAS offline" };
  }

  try {
    const data: any = await fetchPlexSafely(
      "/media/subscriptions/scheduled?includeElements=Metadata,Media"
    );

    if (!isValidPlexSchedulePayload(data)) {
      return {
        updated: false,
        reason: "Plex payload not valid yet",
      };
    }

    const existing = await readPlexCache();

    if (
      existing &&
      !(await shouldUpdateCache(data, existing, config))
    ) {
      return {
        updated: false,
        reason: "plex not ready, cache preserved",
      };
    }

    const cleaned = sanitizePlexPayload(data, config);
    const cached = await writePlexCache(cleaned);

    console.log("[AUTOMATION][SCHEDULED-REFRESH] cache updated");

    return {
      updated: true,
      lastSuccessfulFetch: cached.lastSuccessfulFetch,
      interval: config.REC_SCHEDULE_INTERVALL,
    };
  } catch (err) {
    console.error("[AUTOMATION][SCHEDULED-REFRESH] Plex error", err);
    return { updated: false, reason: "Plex error" };
  }
});


// import { loadConfig } from "~/server/utils/config";
// import { readPlexCache, writePlexCache } from "~/server/utils/plex-cache";
// import { isNasOnlineByPort } from "~/server/utils/nas-utils";
// import { fetchPlexSafely } from "~/server/utils/plex-utils";
// import { ParsedRecording } from "~/utils/plex-recording";

// function extractSchedules(data: any): any[] {
//   return data?.MediaContainer?.MediaGrabOperation ?? [];
// }

// function isValidPlexSchedulePayload(data: any): boolean {
//   const mc = data?.MediaContainer;
//   if (!mc) return false;

//   // Plex antwortet, aber ist noch nicht "bereit"
//   if (!Array.isArray(mc.MediaGrabOperation)) return false;

//   // explizit leer → potentiell Startup-Zustand
//   if (mc.MediaGrabOperation.length === 0) return false;

//   // Optional: erste Aufnahme plausibel prüfen
//   const first = mc.MediaGrabOperation[0];
//   if (!first?.Metadata?.Media?.[0]?.beginsAt) return false;

//   return true;
// }

// async function shouldUpdateCache(
//   newData: any,
//   existingCache: any
// ): Promise<boolean> {
//   const newRaw = extractSchedules(newData);
//   const oldRaw = extractSchedules(existingCache?.data);

//   const newSchedules = filterFutureSchedules(newRaw);
//   const oldSchedules = filterFutureSchedules(oldRaw);

//   // Plex antwortet leer, aber Cache hat zukünftige → blocken
//   if (newSchedules.length === 0 && oldSchedules.length > 0) {
//     return false;
//   }

//   // Weniger Einträge, aber nur weil alte erledigt sind → OK
//   return true;
// }

// export default defineEventHandler(async () => {
//   const config = loadConfig();

//   const nasOnline = await isNasOnlineByPort();
//   if (!nasOnline) {
//     return { updated: false, reason: "NAS offline" };
//   }

//   try {
//     const data: any = await fetchPlexSafely(
//       "/media/subscriptions/scheduled?includeElements=Metadata,Media"
//     );

//     if (!isValidPlexSchedulePayload(data)) {
//       return {
//         updated: false,
//         reason: "Plex payload not valid yet",
//       };
//     }

//     const existing = await readPlexCache();

//     const cleaned = sanitizePlexPayload(data)
//     const cached = await writePlexCache(cleaned);
//     console.log("[AUTOMATION][SCHEDULED-REFRESH] cache updated");

//     return {
//       updated: true,
//       lastSuccessfulFetch: cached.lastSuccessfulFetch,
//       interval: config.REC_SCHEDULE_INTERVALL,
//     };
//   } catch (err) {
//     return { updated: false, reason: "Plex error" };
//   }
// });


// // damit wird die aktuell laufende Sendung aus recordings 
// // gelöscht!
// //
// function filterFutureSchedules(schedules: any[]): any[] {
//   const now = Date.now();

//   return schedules.filter((op) => {
//     const beginsAt = op?.Metadata?.Media?.[0]?.beginsAt;

//     if (!beginsAt) return false;

//     return Number(beginsAt) * 1000 > now;
//   });
// }

// function sanitizePlexPayload(data: any): any {
//   const mc = data?.MediaContainer
//   if (!mc?.MediaGrabOperation) return data

//   mc.MediaGrabOperation =
//      filterFutureSchedules(mc.MediaGrabOperation)

//   return data
// }


// // export default defineEventHandler(async () => {
// //   const config = loadConfig()

// //   // Optional: später auch Plex-Status prüfen
// //   const nasOnline = await isNasOnlineByPort()
// //   if (!nasOnline) {
// //     return { updated: false, reason: "NAS offline" }
// //   }

// //   try {
// //     const data:any = await fetchPlexSafely(
// //       "/media/subscriptions/scheduled?includeElements=Metadata,Media"
// //     )

// //     const cached = await writePlexCache(data)
// //     console.log("[AUTOMATION][SCHEDULED-REFRESH] cache update.")
// //     return {
// //       updated: true,
// //       lastSuccessfulFetch: cached.lastSuccessfulFetch,
// //       interval: config.REC_SCHEDULE_INTERVALL
// //     }
// //   } catch {
// //     return { updated: false, reason: "Plex error" }
// //   }
// // })
