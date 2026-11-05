import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { CalendarEvent, Source } from '../core/types.ts';
import { sourceStats } from '../core/merge.ts';
import {
  COURSE_COLORS, colorFor, listCourses, setColor, toggleHidden, type Prefs, type ThemeMode,
} from '../core/prefs.ts';
import { feedExpiry } from '../core/timeedit.ts';
import { useColors } from '../theme';
import { Btn, Chip } from '../ui';

interface Props {
  /** ALL events (including hidden courses), so hidden courses stay listed here. */
  events: CalendarEvent[];
  sources: Source[];
  prefs: Prefs;
  onPrefs: (next: Prefs) => void;
  onReplacePersonal: () => void;
  onRemoveSource: (id: string) => void;
  /** Try the same calendar link with a later end date; resolves to a message for the user. */
  onExtend: (id: string, end: Date) => Promise<string>;
  onBack: () => void;
}

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export function Settings(p: Props) {
  const c = useColors();
  const [open, setOpen] = useState<string | null>(null);
  const courses = useMemo(() => listCourses(p.events), [p.events]);
  const [note, setNote] = useState<Record<string, string>>({});
  const stats = useMemo(() => sourceStats(p.events, p.sources.map((s) => s.id)), [p.events, p.sources]);
  const personal = p.sources.find((s) => s.kind === 'personal');
  const end = personal ? feedExpiry(personal.url) : null;

  const h = (t: string) => <Text style={[styles.h, { color: c.text }]}>{t}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Btn kind="plain" title="‹ Back" onPress={p.onBack} />
      <Text style={[styles.title, { color: c.text }]}>Settings</Text>

      {h('Appearance')}
      <View style={styles.rowWrap}>
        {THEMES.map((t) => (
          <Chip key={t.mode} title={t.label} selected={p.prefs.theme === t.mode} onPress={() => p.onPrefs({ ...p.prefs, theme: t.mode })} />
        ))}
      </View>

      {h('My schedule')}
      <Text style={{ color: c.sub, marginBottom: 8 }}>
        {personal
          ? `Linked${end ? ` until ${end.toLocaleDateString()}` : ''}. Replace it when you get a new link, for example for a new semester or another account. Your added courses and settings are kept.`
          : 'No schedule linked yet.'}
      </Text>
      <Btn title={personal ? 'Replace My schedule' : 'Link My schedule'} onPress={p.onReplacePersonal} />

      {h('Courses')}
      <Text style={{ color: c.sub, marginBottom: 6 }}>
        Tap a colour dot to change it. Switch a course off to hide it everywhere.
      </Text>
      {courses.length === 0 ? <Text style={{ color: c.sub }}>No courses found yet.</Text> : null}
      {courses.map((course) => {
        const hidden = p.prefs.hidden.includes(course.key);
        return (
          <View key={course.key} style={[styles.course, { borderColor: c.border }]}>
            <View style={styles.courseRow}>
              <Pressable
                accessibilityLabel={`Colour for ${course.key}`}
                onPress={() => setOpen(open === course.key ? null : course.key)}
                style={[styles.dot, { backgroundColor: colorFor(p.prefs, course.key), opacity: hidden ? 0.35 : 1 }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '600', opacity: hidden ? 0.5 : 1 }}>{course.key}</Text>
                {course.title !== course.key ? (
                  <Text numberOfLines={1} style={{ color: c.sub, fontSize: 12 }}>{course.title}</Text>
                ) : null}
              </View>
              <Switch value={!hidden} onValueChange={() => p.onPrefs(toggleHidden(p.prefs, course.key))} />
            </View>
            {open === course.key ? (
              <View style={styles.swatches}>
                {COURSE_COLORS.map((col) => (
                  <Pressable
                    key={col}
                    accessibilityLabel={`Use colour ${col}`}
                    onPress={() => { p.onPrefs(setColor(p.prefs, course.key, col)); setOpen(null); }}
                    style={[styles.swatch, { backgroundColor: col, borderColor: colorFor(p.prefs, course.key) === col ? c.text : 'transparent' }]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {h('Calendars')}
      {p.sources.map((s) => {
        const st = stats.find((x) => x.id === s.id);
        const until = feedExpiry(s.url);
        const day = (t: number) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
        return (
          <View key={s.id} style={[styles.course, { borderColor: c.border }]}>
            <View style={styles.courseRow}>
              <Text style={{ flex: 1, color: c.text, fontWeight: '600' }}>{s.name}</Text>
              {s.kind === 'course' ? <Btn kind="danger" title="Remove" onPress={() => p.onRemoveSource(s.id)} /> : null}
            </View>
            <Text style={{ color: c.sub, fontSize: 12 }}>
              {st && st.count && st.first !== undefined && st.last !== undefined
                ? `${st.count} events, ${day(st.first)} to ${day(st.last)}`
                : 'No events loaded'}
            </Text>
            {until ? (
              <Text style={{ color: c.sub, fontSize: 12 }}>Link ends {until.toLocaleDateString()}</Text>
            ) : null}
            {until ? (
              <Btn
                kind="plain"
                title="Try extending the end date by 3 months"
                onPress={async () => {
                  const from = Math.max(until.getTime(), Date.now());
                  const end = new Date(from);
                  end.setMonth(end.getMonth() + 3);
                  setNote((n) => ({ ...n, [s.id]: 'Trying…' }));
                  const msg = await p.onExtend(s.id, end);
                  setNote((n) => ({ ...n, [s.id]: msg }));
                }}
              />
            ) : null}
            {note[s.id] ? <Text style={{ color: c.text, fontSize: 12 }}>{note[s.id]}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', marginVertical: 8 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  course: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 26, height: 26, borderRadius: 13 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 10, paddingLeft: 38 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
});
