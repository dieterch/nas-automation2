/* ============================================================
   Scheduled Period Evaluation
   ============================================================ */

export function isNowInScheduledPeriod(
  now: Date,
  periods: ScheduledPeriod[] = []
): { active: boolean; reason?: string } {
  for (const p of periods) {
    if (!p || p.enabled === false) continue;

    if (p.type === "daily") {
      if (isNowInTimeRange(now, p.start, p.end)) {
        return { active: true, reason: "daily window " + p.id };
      }
    }

    if (p.type === "weekly") {
      if (
        Array.isArray(p.weekdays) &&
        p.weekdays.includes(now.getDay()) &&
        isNowInTimeRange(now, p.start, p.end)
      ) {
        return { active: true, reason: "weekly window " + p.id };
      }
    }

    if (p.type === "once") {
      if (isNowInOnceRange(now, p.date, p.start, p.end)) {
        return { active: true, reason: "one-time window " + p.id };
      }
    }
  }

  return { active: false };
}

/* ============================================================
   Types
   ============================================================ */

export type ScheduledPeriod =
  | {
      id: string;
      enabled?: boolean;
      type: "daily";
      start: string;
      end: string;
      label?: string;
    }
  | {
      id: string;
      enabled?: boolean;
      type: "weekly";
      weekdays: number[]; // 0=So … 6=Sa
      start: string;
      end: string;
      label?: string;
    }
  | {
      id: string;
      enabled?: boolean;
      type: "once";
      date: string; // YYYY-MM-DD
      start: string;
      end: string;
      label?: string;
    };

/* ============================================================
   Active Window Helper
   ============================================================ */

export function getActiveScheduledWindow(
  now: Date,
  periods: ScheduledPeriod[] = []
) {
  for (const p of periods) {
    if (!p || p.enabled === false) continue;

    if (p.type === "daily") {
      if (isNowInTimeRange(now, p.start, p.end)) {
        return {
          id: p.id,
          type: "daily",
          start: p.start,
          end: p.end,
          label: p.label,
        };
      }
    }

    if (p.type === "weekly") {
      if (
        Array.isArray(p.weekdays) &&
        p.weekdays.includes(now.getDay()) &&
        isNowInTimeRange(now, p.start, p.end)
      ) {
        return {
          id: p.id,
          type: "weekly",
          start: p.start,
          end: p.end,
          label: p.label,
        };
      }
    }

    if (p.type === "once") {
      if (isNowInOnceRange(now, p.date, p.start, p.end)) {
        return {
          id: p.id,
          type: "once",
          start: p.start,
          end: p.end,
          label: p.label,
        };
      }
    }
  }

  return null;
}

/* ============================================================
   Time Helpers
   ============================================================ */

/**
 * Daily / Weekly time range (supports over midnight)
 */
function isNowInTimeRange(
  now: Date,
  startStr: string,
  endStr: string
): boolean {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);

  const end = new Date(now);
  end.setHours(eh, em, 0, 0);

  // über Mitternacht
  if (end <= start) {
    return now >= start || now <= end;
  }

  return now >= start && now <= end;
}

/**
 * One-time window (supports over midnight)
 */
function isNowInOnceRange(
  now: Date,
  dateStr: string,
  startStr: string,
  endStr: string
): boolean {
  // 🔴 FIX: niemals Date-Strings parsen
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);

  const start = new Date(base);
  start.setHours(sh, sm, 0, 0);

  const end = new Date(base);
  end.setHours(eh, em, 0, 0);

  // über Mitternacht → Endzeit auf Folgetag
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return now >= start && now <= end;
}

