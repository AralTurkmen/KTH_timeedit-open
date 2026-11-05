import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import type { CalendarEvent } from '../core/types.ts';
import { colorFor, courseKey, type Prefs } from '../core/prefs.ts';
import { addDays, isoWeek, layoutWeek, startOfWeek } from '../core/week.ts';
import { useColors } from '../theme';
import { Btn } from '../ui';
import { RoomLinks } from './RoomLinks';

const HOUR = 52; // px per hour
const GUTTER = 34;

interface Props {
  events: CalendarEvent[];
  prefs: Prefs;
  refreshing: boolean;
  onRefresh: () => void;
  onRoom: (room: string) => void;
}

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function WeekView({ events, prefs, refreshing, onRefresh, onRoom }: Props) {
  const c = useColors();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(Date.now()));
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const layout = useMemo(() => layoutWeek(events, weekStart), [events, weekStart]);
  const todayStart = startOfWeek(Date.now()) === weekStart ? new Date().setHours(0, 0, 0, 0) : -1;

  const first = new Date(layout.days[0]);
  const last = new Date(layout.days[6]);
  const weekNo = isoWeek(layout.days[0]).week;
  const label = `${first.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
  const hours = Array.from({ length: layout.endHour - layout.startHour }, (_, i) => layout.startHour + i);
  const gridHeight = hours.length * HOUR;

  return (
    <View style={styles.fill}>
      <View style={styles.nav}>
        <Btn kind="plain" title="‹" onPress={() => { setSelected(null); setWeekStart(addDays(weekStart, -7)); }} />
        <Pressable onPress={() => { setSelected(null); setWeekStart(startOfWeek(Date.now())); }}>
          <Text style={{ color: c.text, fontWeight: '700', textAlign: 'center' }}>Week {weekNo}</Text>
          <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>{label}</Text>
          <Text style={{ color: c.sub, fontSize: 11, textAlign: 'center' }}>tap for this week</Text>
        </Pressable>
        <Btn kind="plain" title="›" onPress={() => { setSelected(null); setWeekStart(addDays(weekStart, 7)); }} />
      </View>

      <View style={[styles.row, { paddingLeft: GUTTER }]}>
        {layout.days.map((d, i) => {
          const isToday = d === todayStart;
          const date = new Date(d);
          return (
            <View key={d} style={styles.col}>
              <Text style={{ color: isToday ? c.accent : c.sub, fontSize: 11, fontWeight: '600' }}>
                {date.toLocaleDateString([], { weekday: 'short' })}
              </Text>
              <Text style={{ color: isToday ? c.accent : c.text, fontWeight: '700' }}>{date.getDate()}</Text>
              {layout.allDay.filter((a) => a.day === i).map((a) => (
                <Pressable key={a.event.uid} onPress={() => setSelected(a.event)}>
                  <Text
                    numberOfLines={1}
                    style={[styles.allDay, { backgroundColor: colorFor(prefs, courseKey(a.event)) }]}
                  >
                    {courseKey(a.event)}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={{ flexDirection: 'row', height: gridHeight }}>
          <View style={{ width: GUTTER }}>
            {hours.map((h) => (
              <Text key={h} style={[styles.hour, { color: c.sub, top: (h - layout.startHour) * HOUR }]}>
                {String(h).padStart(2, '0')}
              </Text>
            ))}
          </View>
          {layout.days.map((d, i) => (
            <View key={d} style={[styles.dayCol, { borderLeftColor: c.border }]}>
              {hours.map((h) => (
                <View key={h} style={[styles.line, { top: (h - layout.startHour) * HOUR, backgroundColor: c.border }]} />
              ))}
              {layout.blocks.filter((b) => b.day === i).map((b) => (
                <Pressable
                  key={`${b.event.uid}|${b.startMin}`}
                  onPress={() => setSelected(b.event)}
                  style={[
                    styles.block,
                    {
                      top: ((b.startMin - layout.startHour * 60) / 60) * HOUR,
                      height: Math.max(((b.endMin - b.startMin) / 60) * HOUR - 1, 14),
                      left: `${(b.col / b.cols) * 100}%`,
                      width: `${100 / b.cols}%`,
                      backgroundColor: colorFor(prefs, courseKey(b.event)),
                      opacity: selected && selected !== b.event ? 0.55 : 1,
                    },
                  ]}
                >
                  <Text style={styles.blockText} numberOfLines={2}>{courseKey(b.event)}</Text>
                  {b.event.location ? <Text style={styles.blockSub} numberOfLines={1}>{b.event.location}</Text> : null}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {selected ? (
        <View style={[styles.detail, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.swatch, { backgroundColor: colorFor(prefs, courseKey(selected)) }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>{selected.title}</Text>
            <Text style={{ color: c.sub, fontSize: 12 }}>
              {new Date(selected.start).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
              {selected.allDay ? ' · all day' : ` · ${hhmm(selected.start)}–${hhmm(selected.end)}`}
            </Text>
            {selected.location ? <RoomLinks location={selected.location} onRoom={onRoom} /> : null}
          </View>
          <Btn kind="plain" title="Close" onPress={() => setSelected(null)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  row: { flexDirection: 'row', paddingBottom: 4 },
  col: { flex: 1, alignItems: 'center', paddingHorizontal: 1 },
  allDay: { color: '#fff', fontSize: 9, paddingHorizontal: 3, borderRadius: 3, marginTop: 2, overflow: 'hidden', maxWidth: '100%' },
  hour: { position: 'absolute', left: 0, width: GUTTER - 6, textAlign: 'right', fontSize: 10, marginTop: -6 },
  dayCol: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  line: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  block: { position: 'absolute', borderRadius: 4, padding: 2, overflow: 'hidden' },
  blockText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  blockSub: { color: '#fff', fontSize: 8, opacity: 0.9 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, margin: 8, borderRadius: 10, borderWidth: 1 },
  swatch: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
});
