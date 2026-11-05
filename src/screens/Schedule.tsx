import React, { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent, Source } from '../core/types.ts';
import { groupByDay, upcoming } from '../core/merge.ts';
import { isoWeek } from '../core/week.ts';
import { colorFor, courseKey, type Prefs, type ViewMode } from '../core/prefs.ts';
import { feedExpiry, feedExpiresSoon } from '../core/timeedit.ts';
import { useColors } from '../theme';
import { Btn, Chip } from '../ui';
import { RoomLinks } from './RoomLinks';
import { WeekView } from './WeekView';

interface Props {
  /** Already filtered: hidden courses are not included. */
  events: CalendarEvent[];
  sources: Source[];
  prefs: Prefs;
  refreshing: boolean;
  error: string;
  onRefresh: () => void;
  onView: (v: ViewMode) => void;
  onAddCourse: () => void;
  onSettings: () => void;
  onRoom: (room: string) => void;
  onSignInAgain: () => void;
  onRenew: (sourceId: string) => void;
}

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function Schedule(p: Props) {
  const c = useColors();
  const sections = useMemo(() => {
    let lastWeek = '';
    return groupByDay(upcoming(p.events, Date.now())).map((g) => {
      const start = g.events[0].start;
      const iw = isoWeek(start);
      const wk = `${iw.year}-${iw.week}`;
      const showWeek = wk !== lastWeek;
      lastWeek = wk;
      const day = new Date(start).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
      return { title: showWeek ? `${day} · Week ${iw.week}` : day, data: g.events };
    });
  }, [p.events]);

  const banner = (key: string, text: string, action?: { title: string; onPress: () => void }) => (
    <View key={key} style={[styles.banner, { backgroundColor: c.warnBg }]}>
      <Text style={{ color: c.warnText }}>{text}</Text>
      {action ? <Btn kind="plain" title={action.title} onPress={action.onPress} /> : null}
    </View>
  );

  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Schedule</Text>
        <View style={{ flexDirection: 'row' }}>
          <Btn kind="plain" title="+ Course" onPress={p.onAddCourse} />
          <Btn kind="plain" title="Settings" onPress={p.onSettings} />
        </View>
      </View>
      <View style={styles.chips}>
        <Chip title="Agenda" selected={p.prefs.view === 'agenda'} onPress={() => p.onView('agenda')} />
        <Chip title="Week" selected={p.prefs.view === 'week'} onPress={() => p.onView('week')} />
      </View>

      {p.error ? banner('err', p.error, { title: 'Sign in again', onPress: p.onSignInAgain }) : null}

      {p.sources
        .filter((s) => feedExpiresSoon(s.url, Date.now()))
        .map((s) => {
          const end = feedExpiry(s.url)!;
          const ended = end.getTime() < Date.now();
          return banner(
            s.id,
            `${s.name}: calendar link ${ended ? 'ended' : 'ends'} ${end.toLocaleDateString()}.${ended ? ' New lessons will not appear until you renew it.' : ''}`,
            { title: 'Renew', onPress: () => p.onRenew(s.id) },
          );
        })}

      {p.prefs.view === 'week' ? (
        <WeekView events={p.events} prefs={p.prefs} refreshing={p.refreshing} onRefresh={p.onRefresh} onRoom={p.onRoom} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => `${e.uid}|${e.start}`}
          refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} />}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.day, { color: c.text, backgroundColor: c.bg }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={[styles.event, { backgroundColor: c.card }]}>
              <View style={[styles.bar, { backgroundColor: colorFor(p.prefs, courseKey(item)) }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.time, { color: c.sub }]}>
                  {item.allDay ? 'All day' : `${time(item.start)}–${time(item.end)}`}
                </Text>
                <Text style={[styles.evTitle, { color: c.text }]}>{item.title}</Text>
                {item.location ? (
                  <View style={styles.rooms}>
                    <RoomLinks location={item.location} onRoom={p.onRoom} small />
                  </View>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.sub }]}>Nothing upcoming. Pull down to refresh.</Text>
          }
          ListFooterComponent={
            p.prefs.hidden.length ? (
              <Text style={[styles.empty, { color: c.sub }]}>
                {p.prefs.hidden.length} hidden course{p.prefs.hidden.length === 1 ? '' : 's'} · change in Settings
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  chips: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6 },
  banner: { marginHorizontal: 12, marginVertical: 4, padding: 12, borderRadius: 8 },
  day: { fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, fontSize: 15 },
  event: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 4, borderRadius: 10, overflow: 'hidden' },
  bar: { width: 5 },
  time: { fontSize: 12, paddingHorizontal: 12, paddingTop: 10 },
  evTitle: { fontSize: 16, fontWeight: '600', marginTop: 2, paddingHorizontal: 12 },
  rooms: { paddingHorizontal: 12, paddingBottom: 10 },
  empty: { textAlign: 'center', marginVertical: 30 },
});
