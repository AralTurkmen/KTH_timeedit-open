import type { CalendarEvent } from './types.ts';

/** Undo RFC 5545 line folding and split into logical lines. */
export function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

interface ParsedLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): ParsedLine | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(';');
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

/** Offset (ms) of `tz` from UTC at the instant `ts`. */
function tzOffset(ts: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(ts))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Convert a wall-clock time in IANA zone `tz` to an epoch instant. */
export function zonedToUtc(
  y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string,
): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - tzOffset(guess, tz);
  const second = guess - tzOffset(first, tz);
  return second;
}

export function parseDateValue(
  value: string,
  params: Record<string, string>,
): { ts: number; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const hasTime = m[4] !== undefined;
  if (!hasTime || params.VALUE === 'DATE') {
    return { ts: new Date(y, mo - 1, d).getTime(), allDay: true };
  }
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] ?? 0);
  if (m[7] === 'Z') return { ts: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false };
  if (params.TZID) {
    try {
      return { ts: zonedToUtc(y, mo, d, h, mi, s, params.TZID), allDay: false };
    } catch {
      /* unknown zone: fall through to floating time */
    }
  }
  return { ts: new Date(y, mo - 1, d, h, mi, s).getTime(), allDay: false };
}

function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const [w, d, h, mi, s] = [m[2], m[3], m[4], m[5], m[6]].map((x) => Number(x ?? 0));
  return sign * (((w * 7 + d) * 24 + h) * 3600 + mi * 60 + s) * 1000;
}

/** Guess a course code such as "DAT110" or "TDA357" from free text. */
export function guessCourseCode(text: string): string | undefined {
  const m = /\b([A-ZÅÄÖ]{2,5}\s?\d{2,4}[A-Z]?)\b/.exec(text);
  return m ? m[1].replace(/\s/g, '') : undefined;
}

/**
 * Parse an ICS document into events. TimeEdit expands recurring events itself,
 * so RRULE is intentionally not handled. Cancelled events are skipped.
 */
export function parseIcs(text: string, sourceId: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let cur: Record<string, ParsedLine> | null = null;

  for (const raw of unfold(text)) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) {
        const ev = buildEvent(cur, sourceId);
        if (ev) events.push(ev);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const parsed = parseLine(line);
    if (parsed && !(parsed.name in cur)) cur[parsed.name] = parsed;
  }
  return events;
}

function buildEvent(f: Record<string, ParsedLine>, sourceId: string): CalendarEvent | null {
  if (f.STATUS?.value.toUpperCase() === 'CANCELLED') return null;
  if (!f.DTSTART) return null;
  const start = parseDateValue(f.DTSTART.value, f.DTSTART.params);
  if (!start) return null;

  let end = start.ts;
  if (f.DTEND) {
    const e = parseDateValue(f.DTEND.value, f.DTEND.params);
    if (e) end = e.ts;
  } else if (f.DURATION) {
    end = start.ts + (parseDuration(f.DURATION.value) ?? 0);
  } else if (start.allDay) {
    end = start.ts + 24 * 3600 * 1000;
  }

  const title = unescapeText(f.SUMMARY?.value ?? '').trim();
  const description = unescapeText(f.DESCRIPTION?.value ?? '').trim();
  return {
    uid: f.UID?.value.trim() || `${start.ts}-${title}`,
    start: start.ts,
    end: Math.max(end, start.ts),
    allDay: start.allDay,
    title: title || '(untitled)',
    location: unescapeText(f.LOCATION?.value ?? '').trim(),
    description,
    courseCode: guessCourseCode(title) ?? guessCourseCode(description),
    sourceId,
  };
}
