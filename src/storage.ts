import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarEvent, Source } from './core/types.ts';
import { DEFAULT_PREFS, sanitizePrefs, type Prefs } from './core/prefs.ts';
import { isPlanDataUrl, normalizeRooms, type RoomRecord } from './core/rooms.ts';

const SOURCES_KEY = 'te.sources.v1';
const CACHE_KEY = 'te.events.v1';

export async function loadSources(): Promise<Source[]> {
  try {
    const raw = await AsyncStorage.getItem(SOURCES_KEY);
    return raw ? (JSON.parse(raw) as Source[]) : [];
  } catch {
    return [];
  }
}

export async function saveSources(sources: Source[]): Promise<void> {
  await AsyncStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

/** Last successful merge, so the schedule still shows offline. */
export async function loadCachedEvents(): Promise<CalendarEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
  } catch {
    return [];
  }
}

export async function saveCachedEvents(events: CalendarEvent[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(events));
}

const PREFS_KEY = 'te.prefs.v1';

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return sanitizePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

const ROOMS_KEY = 'te.rooms.v1';

/** Rooms the user has opened: name (upper case) -> id and saved details. Accepts the older id-only format. */
export async function loadRooms(): Promise<Record<string, RoomRecord>> {
  try {
    const raw = await AsyncStorage.getItem(ROOMS_KEY);
    return normalizeRooms(raw ? JSON.parse(raw) : null);
  } catch {
    return {};
  }
}

export async function saveRooms(rooms: Record<string, RoomRecord>): Promise<void> {
  await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

// Floor-plan images are kept one per key, so a large one never bloats the rooms list.
const planKey = (id: string) => `te.plan.${id}`;

export async function loadPlan(id: string): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(planKey(id));
    return isPlanDataUrl(v) ? v : null;
  } catch {
    return null;
  }
}

export async function savePlan(id: string, dataUrl: string): Promise<void> {
  if (isPlanDataUrl(dataUrl)) await AsyncStorage.setItem(planKey(id), dataUrl);
}
