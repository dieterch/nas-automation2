<template>
  <div class="page">
    <h1>Timeline</h1>

    <div class="controls">
      <label>
        Zeitraum:
        <select v-model="range">
          <option value="2d">Heute + Morgen</option>
          <option value="7d">1 Woche</option>
          <option value="all">Alle</option>
        </select>
      </label>
    </div>

    <div ref="timelineContainer" class="timeline-container">

      <svg
        v-if="statusSegments.length"
        :width="svgWidth"
        :height="svgHeight"
        class="timeline"
      >
        <!-- TIME AXIS -->
        <g class="time-axis">
          <g v-for="(t, i) in ticks" :key="i">
            <line
              :x1="xFor(t.time)"
              :x2="xFor(t.time)"
              y1="0"
              :y2="HEADER_HEIGHT"
              class="tick-line"
            />
            <text
              :x="xFor(t.time)"
              y="12"
              text-anchor="middle"
              class="tick-label"
            >
              {{ t.label }}
            </text>
          </g>
        </g>
  
        <!-- NOW LABEL -->
        <g class="now-label">
          <text :x="xFor(now) + 6" :y="HEADER_HEIGHT + 14">
            {{ formatTime(now) }}
          </text>
        </g>
  
        <!-- GRIDLINES -->
        <g class="gridlines">
          <g v-for="(t, i) in ticks" :key="i">
            <line
              :x1="xFor(t.time)"
              :x2="xFor(t.time)"
              :y1="HEADER_HEIGHT"
              :y2="svgHeight"
              class="grid-line"
            />
          </g>
        </g>
  
        <!-- STATUS BACKGROUND -->
        <g v-for="(seg, i) in statusSegments" :key="i">
          <rect
            :x="xFor(seg.start)"
            y="0"
            :width="xFor(seg.end) - xFor(seg.start)"
            :height="svgHeight"
            :class="`bg-${seg.status}`"
          />
        </g>
  
        <!-- RECORDINGS -->
        <g v-for="(r, i) in visibleRecordings" :key="i">
          <rect
            :x="xFor(r.einschaltZeit)"
            :y="rowY(i)"
            :width="xFor(r.sendungsStart) - xFor(r.einschaltZeit)"
            height="20"
            class="prepostrun"
          />
          <rect
            :x="xFor(r.sendungsStart)"
            :y="rowY(i)"
            :width="xFor(r.sendungsEnde) - xFor(r.sendungsStart)"
            height="20"
            class="recording"
          />
          <rect
            :x="xFor(r.sendungsEnde)"
            :y="rowY(i)"
            :width="xFor(r.ausschaltZeit) - xFor(r.sendungsEnde)"
            height="20"
            class="prepostrun"
          />
          <rect
            :x="xFor(r.ausschaltZeit)"
            :y="rowY(i)"
            :width="xFor(r.graceAusschaltZeit) - xFor(r.ausschaltZeit)"
            height="20"
            class="graceperiod"
          />
  
          <text :x="LEFT_PAD - 10" :y="rowY(i) + 12" text-anchor="end">
            {{ r.displayTitle }}
          </text>
          <text
            :x="LEFT_PAD - 10"
            :y="rowY(i) + 26"
            text-anchor="end"
            font-size="12px"
          >
            {{ format(r.sendungsStart) }} – {{ formatTime(r.sendungsEnde) }}
          </text>
        </g>
  
        <!-- NOW -->
        <line
          :x1="xFor(now)"
          :x2="xFor(now)"
          y1="0"
          :y2="svgHeight"
          class="now-line"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

const timelineContainer = ref<HTMLElement | null>(null);
const svgWidth = ref(1000); // fallback

let ro: ResizeObserver | null = null;

onMounted(() => {
  if (!timelineContainer.value) return;

  const update = () => {
    svgWidth.value = timelineContainer.value!.clientWidth;
  };

  update();

  ro = new ResizeObserver(update);
  ro.observe(timelineContainer.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
});

/* ============================================================
   FETCH
============================================================ */

const { data: timelineRaw } = await useFetch("/api/automation/timeline");

/* ============================================================
   TYPES
============================================================ */

interface TimelineRecordingDTO {
  displayTitle: string;
  einschaltZeit: string;
  ausschaltZeit: string;
  graceAusschaltZeit: string;
  aufnahmeStart: string;
  aufnahmeEnde: string;
  sendungsStart: string;
  sendungsEnde: string;
}

type WindowDTO = {
  id: string;
  type: "scheduled" | "recording";
  label: string;
  start: string;
  end: string;
};

type IntervalWithSource = {
  start: Date;
  end: Date;
  source: "recording" | "scheduled";
};

type StatusSegment = {
  start: Date;
  end: Date;
  status: "OFF" | "ACTIVE_RECORDING" | "ACTIVE_SCHEDULED";
};

/* ============================================================
   BASE
============================================================ */

const HEADER_HEIGHT = 12;

const now = computed(() => {
  const n = timelineRaw.value?.now;
  return n ? new Date(n) : new Date();
});

/* ============================================================
   RECORDINGS
============================================================ */

const recordings = computed(() => {
  const tl = timelineRaw.value;
  if (!tl || !Array.isArray(tl.recordings)) return [];

  return tl.recordings.map((r: TimelineRecordingDTO) => ({
    displayTitle: r.displayTitle,
    einschaltZeit: new Date(r.einschaltZeit),
    ausschaltZeit: new Date(r.ausschaltZeit),
    graceAusschaltZeit: new Date(r.graceAusschaltZeit),
    aufnahmeStart: new Date(r.aufnahmeStart),
    aufnahmeEnde: new Date(r.aufnahmeEnde),
    sendungsStart: new Date(r.sendungsStart),
    sendungsEnde: new Date(r.sendungsEnde),
  }));
});

/* ============================================================
   RANGE
============================================================ */

const range = ref<"2d" | "7d" | "all">("2d");

const rangeEnd = computed(() => {
  const d = new Date(now.value);
  if (range.value === "2d") d.setDate(d.getDate() + 2);
  else if (range.value === "7d") d.setDate(d.getDate() + 7);
  else d.setFullYear(d.getFullYear() + 10);
  return d;
});

const visibleRecordings = computed(() =>
  recordings.value.filter(
    (r) =>
      r.graceAusschaltZeit >= now.value &&
      r.einschaltZeit <= rangeEnd.value
  )
);

/* ============================================================
   LAYOUT
============================================================ */

// const SVG_WIDTH = 1000;
const SVG_WIDTH = computed(() => svgWidth.value);
const ROW_HEIGHT = 36;
const LEFT_PAD = computed<number>(() =>
  svgWidth.value < 900 ? 220 : 400
);
const RIGHT_PAD = 0;

const svgHeight = computed(
  () => HEADER_HEIGHT + 40 + visibleRecordings.value.length * ROW_HEIGHT
);

function rowY(i: number): number {
  return HEADER_HEIGHT + 30 + i * ROW_HEIGHT;
}

/* ============================================================
   TIME SCALE
============================================================ */

const minTime = computed(() => {
  const list = visibleRecordings.value;
  if (!list.length) return now.value;
  return new Date(Math.min(...list.map(r => r.einschaltZeit.getTime())));
});

const maxTime = computed(() => {
  const list = visibleRecordings.value;
  if (!list.length) return now.value;
  return new Date(Math.max(...list.map(r => r.graceAusschaltZeit.getTime())));
});

function xFor(t: Date): number {
  const span = maxTime.value.getTime() - minTime.value.getTime();
  if (span <= 0) return LEFT_PAD.value;

  return (
    LEFT_PAD.value +
    ((t.getTime() - minTime.value.getTime()) / span) *
      (SVG_WIDTH.value - LEFT_PAD.value - RIGHT_PAD)
  );
}

/* ============================================================
   TICKS
============================================================ */

type Tick = { time: Date; label: string };

const ticks = computed<Tick[]>(() => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  let step = range.value === "2d" ? 6 * HOUR : DAY;
  const result: Tick[] = [];

  const d = new Date(minTime.value);
  d.setMinutes(0, 0, 0);
  if (step === DAY) d.setHours(0);
  else d.setHours(Math.floor(d.getHours() / 6) * 6);

  while (d <= maxTime.value) {
    result.push({
      time: new Date(d),
      label:
        step === DAY
          ? d.toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" })
          : d.toLocaleTimeString("de-AT", { hour: "2-digit" }),
    });
    d.setTime(d.getTime() + step);
  }
  return result;
});

/* ============================================================
   STATUS SEGMENTS
============================================================ */

const statusSegments = computed<StatusSegment[]>(() => {
  const tl = timelineRaw.value;
  if (!tl || !Array.isArray(tl.windows)) return [];

  const intervals: IntervalWithSource[] = [];

  for (const r of visibleRecordings.value) {
    intervals.push({
      start: r.einschaltZeit,
      end: r.graceAusschaltZeit,
      source: "recording",
    });
  }

  for (const w of tl.windows as WindowDTO[]) {
    if (w.type !== "scheduled") continue;
    const s = new Date(w.start);
    const e = new Date(w.end);
    if (s < e) intervals.push({ start: s, end: e, source: "scheduled" });
  }

  if (!intervals.length) return [];

  intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

  const result: StatusSegment[] = [];
  let cursor = minTime.value.getTime();
  const end = maxTime.value.getTime();

  while (cursor < end) {
    const active = intervals.filter(i => i.start.getTime() <= cursor && i.end.getTime() > cursor);
    let next = end;

    for (const i of intervals) {
      const s = i.start.getTime();
      const e = i.end.getTime();
      if (s > cursor) next = Math.min(next, s);
      if (e > cursor) next = Math.min(next, e);
    }

    result.push({
      start: new Date(cursor),
      end: new Date(next),
      status:
        active.length === 0
          ? "OFF"
          : active.some(a => a.source === "recording")
          ? "ACTIVE_RECORDING"
          : "ACTIVE_SCHEDULED",
    });

    cursor = next;
  }

  return result;
});

/* ============================================================
   FORMAT
============================================================ */

function format(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<style scoped>
.page { padding: 24px; font-family: system-ui; }
.controls { margin-bottom: 12px; }

.timeline-container { width: 100%; overflow-x: auto; }
.timeline { border: 1px solid #ccc; background: #e4e4e487; min-width: 800px;}

rect.bg-ACTIVE_RECORDING { fill: rgba(46,125,50,.15); }
rect.bg-ACTIVE_SCHEDULED { fill: rgba(33,150,243,.18); }
rect.bg-OFF { fill: rgba(198,40,40,.12); }

rect.recording { fill:#1e6222; opacity:.85; }
rect.prepostrun { fill:#adbef4; opacity:.85; }
rect.graceperiod { fill:#f4eba8; opacity:.85; }

.now-line { stroke:red; stroke-width:2; }
.tick-line { stroke:#bbb; }
.tick-label { font-size:11px; }
.grid-line { stroke:#000; stroke-opacity:.08; }
.now-label text { fill:red; font-size:11px; font-weight:600; }
</style>
