import 'react-native-url-polyfill/auto';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { parseIcs } from './src/core/ics.ts';
import { mergeEvents } from './src/core/merge.ts';
import { mergeRecord, roomKey, type RoomRecord } from './src/core/rooms.ts';
import { DEFAULT_PREFS, resolveScheme, visibleEvents, type Prefs } from './src/core/prefs.ts';
import { baseFromFeedUrl, extendFeedUrl, fetchFeed, normalizeFeedUrl, NeedsLoginError } from './src/core/timeedit.ts';
import type { CalendarEvent, Source } from './src/core/types.ts';
import {
  loadCachedEvents, loadPrefs, loadRooms, loadSources, saveCachedEvents, savePrefs, saveRooms, saveSources,
} from './src/storage';
import { palettes, ThemeContext } from './src/theme';
import { AddCourse } from './src/screens/AddCourse';
import { LoginWebView } from './src/screens/LoginWebView';
import { Onboarding } from './src/screens/Onboarding';
import { RoomScreen } from './src/screens/RoomScreen';
import { Schedule } from './src/screens/Schedule';
import { Settings } from './src/screens/Settings';

type LoginPurpose = 'personal' | 'course' | { renew: string };

type Screen =
  | { name: 'loading' }
  | { name: 'onboarding'; cancelable?: boolean }
  | { name: 'login'; startUrl: string; purpose: LoginPurpose }
  | { name: 'schedule' }
  | { name: 'settings' }
  | { name: 'add' }
  | { name: 'room'; room: string };

const newId = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [sources, setSources] = useState<Source[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [rooms, setRooms] = useState<Record<string, RoomRecord>>({});
  const roomsRef = useRef(rooms);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const system = useColorScheme();
  const scheme = resolveScheme(prefs.theme, system === 'dark' ? 'dark' : system === 'light' ? 'light' : null);
  const colors = palettes[scheme];
  const shown = useMemo(() => visibleEvents(events, prefs), [events, prefs]);

  const updatePrefs = (next: Prefs) => {
    setPrefs(next);
    savePrefs(next).catch(() => {});
  };

  /** Remember what a room page told us (details, floor plan address, photos). */
  const saveRoom = (room: string, patch: RoomRecord) => {
    const key = roomKey(room);
    const old = roomsRef.current[key];
    const merged = mergeRecord(old, patch);
    if (JSON.stringify(merged) === JSON.stringify(old)) return;
    const next = { ...roomsRef.current, [key]: merged };
    roomsRef.current = next;
    setRooms(next);
    saveRooms(next).catch(() => {});
  };

  const refresh = useCallback(async (list: Source[]) => {
    if (!list.length) return;
    setRefreshing(true);
    setError('');
    const results = await Promise.allSettled(
      list.map(async (s) => parseIcs(await fetchFeed(s.url), s.id)),
    );
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (ok.length) {
      const merged = mergeEvents(ok);
      setEvents(merged);
      saveCachedEvents(merged).catch(() => {});
    }
    if (failed) {
      setError(
        failed.reason instanceof NeedsLoginError
          ? 'Your session expired. Sign in again to refresh.'
          : `Could not refresh: ${(failed.reason as Error).message}. Showing saved data.`,
      );
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => {
      const [s, cached, p, r] = await Promise.all([loadSources(), loadCachedEvents(), loadPrefs(), loadRooms()]);
      setSources(s);
      setEvents(cached);
      setPrefs(p);
      roomsRef.current = r;
      setRooms(r);
      setScreen({ name: s.length ? 'schedule' : 'onboarding' });
      refresh(s);
    })();
  }, [refresh]);

  const update = (next: Source[]) => {
    setSources(next);
    saveSources(next).catch(() => {});
    refresh(next);
  };

  /** Replaces the personal calendar (keeps added courses and all settings). */
  const setPersonal = (url: string) => {
    const old = sources.find((s) => s.kind === 'personal');
    const rest = sources.filter((s) => s.kind !== 'personal');
    update([{ id: old?.id ?? newId(), name: 'My schedule', url, kind: 'personal' }, ...rest]);
    setScreen({ name: 'schedule' });
  };

  const personal = sources.find((s) => s.kind === 'personal');

  const addCourse = (rawUrl: string) => {
    const url = normalizeFeedUrl(rawUrl);
    const n = sources.filter((s) => s.kind === 'course').length + 1;
    update([...sources, { id: newId(), name: `Courses ${n}`, url, kind: 'course' }]);
    setScreen({ name: 'schedule' });
  };

  const renewSource = (id: string, rawUrl: string) => {
    const url = normalizeFeedUrl(rawUrl);
    update(sources.map((s) => (s.id === id ? { ...s, url } : s)));
    setScreen({ name: 'schedule' });
  };

  /** Tries the link with a later end date. Only adopted if KTH still answers with a calendar. */
  const extendSource = async (id: string, end: Date): Promise<string> => {
    const src = sources.find((x) => x.id === id);
    const url = src ? extendFeedUrl(src.url, end) : null;
    if (!src || !url) return 'This link has no end date to change.';
    try {
      const count = parseIcs(await fetchFeed(url), id).length;
      update(sources.map((x) => (x.id === id ? { ...x, url } : x)));
      return `Accepted. The link now ends ${end.toLocaleDateString()} and returned ${count} events. Check the date range above after refreshing.`;
    } catch {
      return 'TimeEdit did not accept the edited link. Make a new Subscribe link in TimeEdit with a later end date and use Replace My schedule (or Renew).';
    }
  };

  const onFeedFound = (purpose: LoginPurpose, rawUrl: string) => {
    if (purpose === 'personal') setPersonal(normalizeFeedUrl(rawUrl));
    else if (purpose === 'course') addCourse(rawUrl);
    else renewSource(purpose.renew, rawUrl);
  };

  return (
    <ThemeContext.Provider value={colors}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar barStyle={colors.dark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
          {screen.name === 'onboarding' && (
            <Onboarding
              onFeed={setPersonal}
              onLogin={(startUrl) => setScreen({ name: 'login', startUrl, purpose: 'personal' })}
              onCancel={screen.cancelable ? () => setScreen({ name: 'settings' }) : undefined}
            />
          )}
          {screen.name === 'login' && (
            <LoginWebView
              startUrl={screen.startUrl}
              onFeedFound={(url) => onFeedFound(screen.purpose, url)}
              onCancel={() => setScreen({ name: sources.length ? 'schedule' : 'onboarding' })}
            />
          )}
          {screen.name === 'schedule' && (
            <Schedule
              events={shown}
              sources={sources}
              prefs={prefs}
              refreshing={refreshing}
              error={error}
              onRefresh={() => refresh(sources)}
              onView={(view) => updatePrefs({ ...prefs, view })}
              onAddCourse={() => (personal ? setScreen({ name: 'add' }) : setScreen({ name: 'onboarding' }))}
              onSettings={() => setScreen({ name: 'settings' })}
              onRoom={(room) => setScreen({ name: 'room', room })}
              onSignInAgain={() =>
                setScreen(
                  personal
                    ? { name: 'login', startUrl: baseFromFeedUrl(personal.url), purpose: { renew: personal.id } }
                    : { name: 'onboarding' },
                )
              }
              onRenew={(id) => {
                const src = sources.find((x) => x.id === id);
                if (src) setScreen({ name: 'login', startUrl: baseFromFeedUrl(src.url), purpose: { renew: id } });
              }}
            />
          )}
          {screen.name === 'settings' && (
            <Settings
              events={events}
              sources={sources}
              prefs={prefs}
              onPrefs={updatePrefs}
              onReplacePersonal={() => setScreen({ name: 'onboarding', cancelable: true })}
              onRemoveSource={(id) => update(sources.filter((s) => s.id !== id))}
              onExtend={extendSource}
              onBack={() => setScreen({ name: 'schedule' })}
            />
          )}
          {screen.name === 'room' && (
            <RoomScreen
              key={screen.room}
              room={screen.room}
              record={rooms[roomKey(screen.room)]}
              onSave={saveRoom}
              onBack={() => setScreen({ name: 'schedule' })}
            />
          )}
          {screen.name === 'add' && personal && (
            <AddCourse
              onBack={() => setScreen({ name: 'schedule' })}
              onBrowse={() => setScreen({ name: 'login', startUrl: baseFromFeedUrl(personal.url), purpose: 'course' })}
              onAddPasted={addCourse}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}
