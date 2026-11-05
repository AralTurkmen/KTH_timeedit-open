import type { CalendarEvent } from './types.ts';

/** Merge several event lists, drop duplicates (same uid + start), sort by start. */
export function mergeEvents(lists: CalendarEvent[][]): CalendarEvent[] {
  const seen = new Map<string, CalendarEvent>();
  for (const list of lists) {
    for (const ev of list) {
      const key = `${ev.uid}|${ev.start}`;
      if (!seen.has(key)) seen.set(key, ev);
    }
  }
  return [...seen.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface DayGroup {
  day: string;
  events: CalendarEvent[];
}

/** Group sorted events by local calendar day. */
export function groupByDay(events: CalendarEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const ev of events) {
    const key = dayKey(ev.start);
    const last = groups[groups.length - 1];
    if (last && last.day === key) last.events.push(ev);
    else groups.push({ day: key, events: [ev] });
  }
  return groups;
}

/** Events that have not ended yet at `now`. */
export function upcoming(events: CalendarEvent[], now: number): CalendarEvent[] {
  return events.filter((e) => e.end >= now);
}

export interface SourceStats {
  id: string;
  count: number;
  /** Start of the earliest and latest event, if any. */
  first?: number;
  last?: number;
}

/** How many events each calendar delivered and over which dates. Helps spot a feed that stops early. */
export function sourceStats(events: CalendarEvent[], sourceIds: string[]): SourceStats[] {
  return sourceIds.map((id) => {
    const mine = events.filter((e) => e.sourceId === id);
    if (!mine.length) return { id, count: 0 };
    return {
      id,
      count: mine.length,
      first: Math.min(...mine.map((e) => e.start)),
      last: Math.max(...mine.map((e) => e.start)),
    };
  });
}
