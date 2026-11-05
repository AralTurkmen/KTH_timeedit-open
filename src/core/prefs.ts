import type { CalendarEvent } from './types.ts';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ViewMode = 'agenda' | 'week';

export interface Prefs {
  theme: ThemeMode;
  view: ViewMode;
  /** Course keys the user has hidden. */
  hidden: string[];
  /** Course key -> hex colour chosen by the user. */
  colors: Record<string, string>;
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', view: 'agenda', hidden: [], colors: {} };

/** All dark enough for white text, and readable on both light and dark backgrounds. */
export const COURSE_COLORS = [
  '#2563eb', '#059669', '#b45309', '#db2777',
  '#7c3aed', '#0e7490', '#dc2626', '#4d7c0f',
];

/** Identifies a course: its code if we found one, else the event title. */
export function courseKey(e: CalendarEvent): string {
  return e.courseCode ?? e.title;
}

export function defaultColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COURSE_COLORS[h % COURSE_COLORS.length];
}

export function colorFor(prefs: Prefs, key: string): string {
  return prefs.colors[key] ?? defaultColor(key);
}

export interface CourseInfo {
  key: string;
  /** A readable title taken from the first event of the course. */
  title: string;
  count: number;
}

/** Distinct courses found in the events, sorted by key. */
export function listCourses(events: CalendarEvent[]): CourseInfo[] {
  const map = new Map<string, CourseInfo>();
  for (const e of events) {
    const key = courseKey(e);
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { key, title: e.title, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function visibleEvents(events: CalendarEvent[], prefs: Prefs): CalendarEvent[] {
  if (!prefs.hidden.length) return events;
  const hidden = new Set(prefs.hidden);
  return events.filter((e) => !hidden.has(courseKey(e)));
}

export function toggleHidden(prefs: Prefs, key: string): Prefs {
  const hidden = prefs.hidden.includes(key)
    ? prefs.hidden.filter((k) => k !== key)
    : [...prefs.hidden, key];
  return { ...prefs, hidden };
}

export function setColor(prefs: Prefs, key: string, color: string): Prefs {
  return { ...prefs, colors: { ...prefs.colors, [key]: color } };
}

export function resolveScheme(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  return system === 'dark' ? 'dark' : 'light';
}

/** Turn whatever was stored into a valid Prefs, ignoring anything malformed. */
export function sanitizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const colors: Record<string, string> = {};
  if (r.colors && typeof r.colors === 'object') {
    for (const [k, v] of Object.entries(r.colors as Record<string, unknown>)) {
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) colors[k] = v;
    }
  }
  return {
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
    view: r.view === 'week' ? 'week' : 'agenda',
    hidden: Array.isArray(r.hidden) ? r.hidden.filter((x): x is string => typeof x === 'string') : [],
    colors,
  };
}
