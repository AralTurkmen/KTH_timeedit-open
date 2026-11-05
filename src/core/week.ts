import type { CalendarEvent } from './types.ts';

/** Midnight (local) of `n` days after the day containing `ts`. DST-safe. */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** Monday 00:00 local of the week containing `ts`. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const sinceMonday = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime();
}

export interface WeekBlock {
  event: CalendarEvent;
  /** 0 = Monday ... 6 = Sunday */
  day: number;
  /** Minutes after midnight, clipped to this day. */
  startMin: number;
  endMin: number;
  /** Side-by-side position for overlapping events. */
  col: number;
  cols: number;
}

export interface WeekLayout {
  /** Midnight timestamps of the 7 days. */
  days: number[];
  startHour: number;
  endHour: number;
  blocks: WeekBlock[];
  allDay: { day: number; event: CalendarEvent }[];
}

const MIN_BLOCK_MIN = 30;

export function layoutWeek(events: CalendarEvent[], weekStart: number): WeekLayout {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const blocks: WeekBlock[] = [];
  const allDay: WeekLayout['allDay'] = [];

  days.forEach((dayStart, day) => {
    const dayEnd = addDays(dayStart, 1);
    const todays = events
      .filter((e) => e.start < dayEnd && Math.max(e.end, e.start + 1) > dayStart)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const timed: WeekBlock[] = [];
    for (const event of todays) {
      if (event.allDay) {
        allDay.push({ day, event });
        continue;
      }
      const s = Math.max(event.start, dayStart);
      const e = Math.min(event.end, dayEnd);
      const startMin = Math.round((s - dayStart) / 60000);
      const endMin = Math.max(Math.round((e - dayStart) / 60000), startMin + MIN_BLOCK_MIN);
      timed.push({ event, day, startMin, endMin, col: 0, cols: 1 });
    }

    // Place overlapping events side by side, cluster by cluster.
    let cluster: WeekBlock[] = [];
    let colEnds: number[] = [];
    let clusterEnd = -1;
    const flush = () => {
      for (const b of cluster) b.cols = colEnds.length;
      cluster = [];
      colEnds = [];
    };
    for (const b of timed) {
      if (b.startMin >= clusterEnd) flush();
      let col = colEnds.findIndex((end) => end <= b.startMin);
      if (col < 0) col = colEnds.length;
      colEnds[col] = b.endMin;
      b.col = col;
      cluster.push(b);
      clusterEnd = cluster.length === 1 ? b.endMin : Math.max(clusterEnd, b.endMin);
    }
    flush();
    blocks.push(...timed);
  });

  // Keep the grid at least 08-18 so weeks look stable; widen for early/late events.
  let startHour = 8;
  let endHour = 18;
  for (const b of blocks) {
    startHour = Math.min(startHour, Math.floor(b.startMin / 60));
    endHour = Math.max(endHour, Math.ceil(b.endMin / 60));
  }
  return { days, startHour, endHour: Math.min(endHour, 24), blocks, allDay };
}

/** ISO 8601 week number (the one used in Sweden): weeks start Monday, week 1 contains 4 Jan. */
export function isoWeek(ts: number): { week: number; year: number } {
  const d = new Date(ts);
  // work on the Thursday of this week, in UTC to avoid DST effects
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const year = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((t.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { week, year };
}
