/** Helpers for looking up rooms on kth.se/places. Pure functions, no network. */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Split a TimeEdit location such as "Q31, Q32" or "V3 (Teknikringen 72)" into room names.
 * Anything in parentheses is dropped; duplicates are removed.
 */
export function splitRooms(location: string): string[] {
  const out: string[] = [];
  for (const part of location.split(/[,;\n]/)) {
    const name = part.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    if (name && !out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

export const roomKey = (room: string) => room.trim().toUpperCase();

export function roomSearchUrl(room: string): string {
  const q = encodeURIComponent(room.trim());
  return `https://www.kth.se/search?q=${q}&entityFilter=kth-place&filterLabel=Lokaler&lang=sv&btnText=&activeTab=webpages`;
}

export function roomPageUrl(id: string): string {
  return `https://www.kth.se/places/room/id/${id}`;
}

/** The room id if `url` is a KTH room page, else null. */
export function roomIdFromUrl(url: string): string | null {
  const m = new RegExp(`/places/room/id/(${UUID})`, 'i').exec(url);
  return m ? m[1].toLowerCase() : null;
}

export interface RoomInfo {
  /** e.g. "Hörsal" */
  type?: string;
  address?: string;
  /** Room number */
  number?: string;
  /** Room code, e.g. "V3" */
  code?: string;
  floor?: string;
  building?: string;
  campus?: string;
}

const LABELS: [keyof RoomInfo, string][] = [
  ['address', 'Adress|Address'],
  ['number', 'Rumsnr|Room number|Room no'],
  ['code', 'Lokalkod|Room code'],
  ['floor', 'Vån|Floor'],
  ['building', 'Byggnad|Building'],
  ['campus', 'Campus'],
];

/**
 * Read the facts block of a KTH room page from its visible text. Handles the labels
 * running together ("Rumsnr: 203Lokalkod: V3Vån: 05") and Swedish or English labels.
 */
export function parseRoomText(text: string): RoomInfo {
  const all = LABELS.map(([, l]) => l).join('|');
  const re = new RegExp(`(${all})\\s*:`, 'gi');
  const hits: { start: number; end: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) hits.push({ start: m.index, end: re.lastIndex, label: m[1].toLowerCase() });

  const info: RoomInfo = {};
  hits.forEach((h, i) => {
    const key = LABELS.find(([, l]) => new RegExp(`^(${l})$`, 'i').test(h.label))?.[0];
    if (!key || info[key] !== undefined) return;
    const stop = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const raw = text.slice(h.end, stop).split('\n')[0];
    const value = raw.replace(/[\s,;]+$/g, '').trim();
    if (value) info[key] = value;
  });

  if (hits.length) {
    const before = text.slice(0, hits[0].start).split('\n').map((l) => l.trim()).filter(Boolean);
    const last = before[before.length - 1];
    if (last && last.length <= 40 && !last.includes(':')) info.type = last;
  }
  return info;
}

/** Does the page's room code match the room we were looking for? */
export function sameRoom(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  return n(a) === n(b);
}

// ---------------------------------------------------------------------------
// Saved rooms: what the app remembers after you have opened a room once.
// ---------------------------------------------------------------------------

export interface RoomRecord {
  id: string;
  info?: RoomInfo;
  /** Address of the floor-plan image on kth.se (used if the image itself was not saved). */
  planUrl?: string;
  /** Room photo addresses on kth.se. */
  photos?: string[];
}

const INFO_KEYS: (keyof RoomInfo)[] = ['type', 'address', 'number', 'code', 'floor', 'building', 'campus'];
const UUID_RE = new RegExp(`^${UUID}$`, 'i');

export const isKthUrl = (u: unknown): u is string =>
  typeof u === 'string' && /^https:\/\/([a-z0-9-]+\.)*kth\.se\//i.test(u);

/** Largest floor-plan data URL (in characters) we are willing to store. */
export const MAX_PLAN_CHARS = 1_500_000;

export function isPlanDataUrl(s: unknown): s is string {
  return typeof s === 'string' && s.length <= MAX_PLAN_CHARS && /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s);
}

export function cleanInfo(raw: unknown): RoomInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: RoomInfo = {};
  for (const k of INFO_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim() && v.length <= 120) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

/** Read stored rooms, accepting the older format (name -> id string) and ignoring junk. */
export function normalizeRooms(raw: unknown): Record<string, RoomRecord> {
  const out: Record<string, RoomRecord> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && UUID_RE.test(v)) {
      out[name] = { id: v.toLowerCase() };
    } else if (v && typeof v === 'object' && typeof (v as RoomRecord).id === 'string' && UUID_RE.test((v as RoomRecord).id)) {
      const r = v as RoomRecord;
      const rec: RoomRecord = { id: r.id.toLowerCase() };
      const info = cleanInfo(r.info);
      if (info) rec.info = info;
      if (isKthUrl(r.planUrl)) rec.planUrl = r.planUrl;
      if (Array.isArray(r.photos)) {
        const photos = r.photos.filter(isKthUrl).slice(0, 6);
        if (photos.length) rec.photos = photos;
      }
      out[name] = rec;
    }
  }
  return out;
}

/** Combine what we knew with what the page just told us. Never replaces good data with nothing. */
export function mergeRecord(old: RoomRecord | undefined, patch: RoomRecord): RoomRecord {
  const prev = old && old.id === patch.id ? old : undefined;
  const rec: RoomRecord = { id: patch.id };
  const info = cleanInfo(patch.info) ?? prev?.info;
  if (info) rec.info = info;
  const planUrl = isKthUrl(patch.planUrl) ? patch.planUrl : prev?.planUrl;
  if (planUrl) rec.planUrl = planUrl;
  const photos = patch.photos?.filter(isKthUrl).slice(0, 6);
  const keep = photos && photos.length ? photos : prev?.photos;
  if (keep && keep.length) rec.photos = keep;
  return rec;
}

export const hasDetails = (r?: RoomRecord): boolean => !!(r && (r.info || r.planUrl));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A tiny zoomable page showing one image. Only saved data URLs and kth.se addresses are accepted. */
export function planHtml(src: string): string {
  if (!isPlanDataUrl(src) && !isKthUrl(src)) return '';
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=0.5, maximum-scale=6, user-scalable=yes">' +
    '<style>html,body{margin:0;background:#fff}img{width:100%;height:auto;display:block}</style></head>' +
    `<body><img src="${esc(src)}"></body></html>`
  );
}
