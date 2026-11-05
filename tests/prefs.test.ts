import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CalendarEvent } from '../src/core/types.ts';
import {
  DEFAULT_PREFS, COURSE_COLORS, courseKey, defaultColor, colorFor, listCourses,
  visibleEvents, toggleHidden, setColor, resolveScheme, sanitizePrefs,
} from '../src/core/prefs.ts';
import { addDays, startOfWeek, layoutWeek } from '../src/core/week.ts';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  uid: 'u', start: 0, end: 0, allDay: false, title: 'T', location: '', description: '', sourceId: 's', ...over,
});
const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

test('course keys, default colours are stable and from the palette', () => {
  assert.equal(courseKey(ev({ courseCode: 'DD1310', title: 'DD1310 Lecture' })), 'DD1310');
  assert.equal(courseKey(ev({ title: 'Guest talk' })), 'Guest talk');
  assert.equal(defaultColor('DD1310'), defaultColor('DD1310'));
  assert.ok(COURSE_COLORS.includes(defaultColor('anything')));
});

test('listCourses, hiding and colours', () => {
  const events = [
    ev({ uid: '1', courseCode: 'B2', title: 'B2 Lab' }),
    ev({ uid: '2', courseCode: 'A1', title: 'A1 Lecture' }),
    ev({ uid: '3', courseCode: 'A1', title: 'A1 Lab' }),
  ];
  assert.deepEqual(listCourses(events).map((c) => [c.key, c.count]), [['A1', 2], ['B2', 1]]);

  const hidden = toggleHidden(DEFAULT_PREFS, 'A1');
  assert.deepEqual(visibleEvents(events, hidden).map((e) => e.uid), ['1']);
  assert.deepEqual(toggleHidden(hidden, 'A1').hidden, []);
  assert.equal(visibleEvents(events, DEFAULT_PREFS), events);

  const coloured = setColor(DEFAULT_PREFS, 'A1', '#112233');
  assert.equal(colorFor(coloured, 'A1'), '#112233');
  assert.equal(colorFor(coloured, 'B2'), defaultColor('B2'));
});

test('resolveScheme and sanitizePrefs', () => {
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', null), 'light');
  assert.equal(resolveScheme('light', 'dark'), 'light');
  assert.deepEqual(sanitizePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(
    sanitizePrefs({ theme: 'dark', view: 'week', hidden: ['x', 5], colors: { a: '#abcdef', b: 'red', c: 7 } }),
    { theme: 'dark', view: 'week', hidden: ['x'], colors: { a: '#abcdef' } },
  );
  assert.equal(sanitizePrefs({ theme: 'neon' }).theme, 'system');
});

test('week helpers start on Monday', () => {
  // 2026-11-04 is a Wednesday; its week starts Monday 2026-11-02. Sunday 2026-11-08 belongs to it.
  assert.equal(startOfWeek(at(2026, 11, 4, 15)), at(2026, 11, 2));
  assert.equal(startOfWeek(at(2026, 11, 8, 23, 59)), at(2026, 11, 2));
  assert.equal(startOfWeek(at(2026, 11, 9)), at(2026, 11, 9));
  assert.equal(addDays(at(2026, 11, 2), 7), at(2026, 11, 9));
  // across the autumn DST change in Europe (2026-10-25) the result is still local midnight
  assert.equal(new Date(addDays(at(2026, 10, 24), 2)).getHours(), 0);
});

test('layoutWeek places events, splits overlaps, clips midnight, lists all-day', () => {
  const ws = at(2026, 11, 2);
  const events = [
    ev({ uid: 'a', title: 'A', start: at(2026, 11, 2, 10), end: at(2026, 11, 2, 12) }),
    ev({ uid: 'b', title: 'B', start: at(2026, 11, 2, 11), end: at(2026, 11, 2, 13) }),
    ev({ uid: 'c', title: 'C', start: at(2026, 11, 2, 13), end: at(2026, 11, 2, 14) }),
    ev({ uid: 'n', title: 'Night', start: at(2026, 11, 3, 23), end: at(2026, 11, 4, 1) }),
    ev({ uid: 'x', title: 'Exam day', allDay: true, start: at(2026, 11, 5), end: at(2026, 11, 6) }),
    ev({ uid: 'out', title: 'Next week', start: at(2026, 11, 10, 9), end: at(2026, 11, 10, 10) }),
  ];
  const l = layoutWeek(events, ws);
  const by = (uid: string) => l.blocks.filter((b) => b.event.uid === uid);

  const [a] = by('a');
  const [b] = by('b');
  const [c] = by('c');
  assert.deepEqual([a.col, a.cols, b.col, b.cols], [0, 2, 1, 2]);
  assert.deepEqual([c.col, c.cols], [0, 1]);
  assert.deepEqual([a.day, a.startMin, a.endMin], [0, 600, 720]);

  // the night event shows on Tuesday until midnight and on Wednesday from midnight
  const night = by('n');
  assert.equal(night.length, 2);
  assert.deepEqual([night[0].day, night[0].startMin, night[0].endMin], [1, 23 * 60, 24 * 60]);
  assert.deepEqual([night[1].day, night[1].startMin, night[1].endMin], [2, 0, 60]);

  assert.deepEqual(l.allDay.map((x) => [x.day, x.event.uid]), [[3, 'x']]);
  assert.equal(by('out').length, 0);
  assert.equal(l.startHour, 0);
  assert.equal(l.endHour, 24);
});

test('layoutWeek keeps a stable 08-18 grid for ordinary weeks and enforces min height', () => {
  const ws = at(2026, 11, 2);
  const l = layoutWeek([ev({ uid: 'q', start: at(2026, 11, 3, 10), end: at(2026, 11, 3, 10, 5) })], ws);
  assert.deepEqual([l.startHour, l.endHour], [8, 18]);
  assert.equal(l.blocks[0].endMin - l.blocks[0].startMin, 30);
  assert.deepEqual(layoutWeek([], ws).blocks, []);
});
