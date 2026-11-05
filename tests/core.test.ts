import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, zonedToUtc, guessCourseCode } from '../src/core/ics.ts';
import { mergeEvents, groupByDay, upcoming, sourceStats } from '../src/core/merge.ts';
import {
  normalizeFeedUrl, baseFromFeedUrl, feedExpiry, feedExpiresSoon, extendFeedUrl, fetchFeed, NeedsLoginError,
} from '../src/core/timeedit.ts';

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:abc-1',
  'DTSTART:20261109T081500Z',
  'DTEND:20261109T094500Z',
  'SUMMARY:DAT110 Lecture\\, intro',
  'LOCATION:Room M\\;2',
  'DESCRIPTION:Line one\\nLine two that is long and',
  '  continues here',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:abc-2',
  'DTSTART;TZID=Europe/Stockholm:20261110T100000',
  'DTEND;TZID=Europe/Stockholm:20261110T120000',
  'SUMMARY:TDA357 Lab',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:abc-3',
  'DTSTART:20261111T080000Z',
  'STATUS:CANCELLED',
  'SUMMARY:Cancelled',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:abc-4',
  'DTSTART;VALUE=DATE:20261112',
  'SUMMARY:Exam day',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('parses UTC events, unescapes text and unfolds lines', () => {
  const [e] = parseIcs(ICS, 's1');
  assert.equal(e.uid, 'abc-1');
  assert.equal(e.start, Date.UTC(2026, 10, 9, 8, 15));
  assert.equal(e.end, Date.UTC(2026, 10, 9, 9, 45));
  assert.equal(e.title, 'DAT110 Lecture, intro');
  assert.equal(e.location, 'Room M;2');
  assert.equal(e.description, 'Line one\nLine two that is long and continues here');
  assert.equal(e.courseCode, 'DAT110');
  assert.equal(e.sourceId, 's1');
});

test('TZID events convert to the right UTC instant (winter, CET = UTC+1)', () => {
  const evs = parseIcs(ICS, 's1');
  const lab = evs.find((e) => e.uid === 'abc-2')!;
  assert.equal(lab.start, Date.UTC(2026, 10, 10, 9, 0));
  assert.equal(lab.end, Date.UTC(2026, 10, 10, 11, 0));
});

test('zonedToUtc handles summer time (CEST = UTC+2)', () => {
  assert.equal(zonedToUtc(2026, 6, 15, 12, 0, 0, 'Europe/Stockholm'), Date.UTC(2026, 5, 15, 10, 0));
});

test('skips cancelled events and handles all-day events', () => {
  const evs = parseIcs(ICS, 's1');
  assert.equal(evs.length, 3);
  assert.ok(!evs.some((e) => e.uid === 'abc-3'));
  const day = evs.find((e) => e.uid === 'abc-4')!;
  assert.equal(day.allDay, true);
  assert.equal(day.end - day.start, 24 * 3600 * 1000);
});

test('guessCourseCode', () => {
  assert.equal(guessCourseCode('TDA357 Databases'), 'TDA357');
  assert.equal(guessCourseCode('MVE 045 lecture'), 'MVE045');
  assert.equal(guessCourseCode('nothing here'), undefined);
});

test('mergeEvents dedupes and sorts; groupByDay and upcoming work', () => {
  const a = parseIcs(ICS, 'a');
  const b = parseIcs(ICS, 'b');
  const merged = mergeEvents([a, b]);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((e) => e.uid), ['abc-1', 'abc-2', 'abc-4']);
  assert.equal(groupByDay(merged).length, 3);
  const cutoff = Date.UTC(2026, 10, 10, 0, 0);
  assert.equal(upcoming(merged, cutoff).length, 2);
});

// Shapes copied from real KTH subscribe links; tokens replaced with fakes.
const KTH_PERSONAL = 'https://cloud.timeedit.net/kth/web/stud02/ri.ics?sid=23&objects=525160.47&p=0.m%2C20270111.x&l=sv&e=2611&ku=FAKEUSERKEY&k=FAKESIGNATURE';
const KTH_COURSES = 'https://cloud.timeedit.net/kth/web/stud02/ri.ics?sid=7&p=0.m%2C20180609.x&objects=504492.10%2C504523%2C509874&l=sv&e=2611&ku=FAKEUSERKEY&k=FAKESIGNATURE';

test('URL helpers', () => {
  assert.equal(normalizeFeedUrl(' webcal://cloud.timeedit.net/kth/web/stud02/ri.ics?a=1 '), 'https://cloud.timeedit.net/kth/web/stud02/ri.ics?a=1');
  assert.throws(() => normalizeFeedUrl('hello'));
  assert.equal(baseFromFeedUrl(KTH_PERSONAL), 'https://cloud.timeedit.net/kth/web/stud02/');
});

test('feedExpiry reads the end date from KTH links', () => {
  const end = feedExpiry(KTH_PERSONAL)!;
  assert.deepEqual([end.getFullYear(), end.getMonth(), end.getDate()], [2027, 0, 11]);
  assert.equal(feedExpiry(KTH_COURSES)!.getFullYear(), 2018);
  assert.equal(feedExpiry('https://x.test/ri.ics?sid=1'), null);
  const now = Date.UTC(2026, 10, 4);
  assert.equal(feedExpiresSoon(KTH_PERSONAL, now), false);
  assert.equal(feedExpiresSoon(KTH_PERSONAL, Date.UTC(2027, 0, 1)), true);
  assert.equal(feedExpiresSoon(KTH_COURSES, now), true);
});

test('fetchFeed throws NeedsLoginError for non-calendar responses', async () => {
  const fake = (async () => new Response('<html>Login</html>', { status: 200 })) as typeof fetch;
  await assert.rejects(fetchFeed('https://x.test/ri.ics', { fetchFn: fake }), NeedsLoginError);
  const ok = (async () => new Response(ICS, { status: 200 })) as typeof fetch;
  assert.match(await fetchFeed('https://x.test/ri.ics', { fetchFn: ok }), /BEGIN:VCALENDAR/);
});

test('extendFeedUrl changes only the end date', () => {
  const out = extendFeedUrl(KTH_PERSONAL, new Date(2027, 3, 11))!;
  assert.equal(out, KTH_PERSONAL.replace('20270111', '20270411'));
  assert.equal(feedExpiry(out)!.getMonth(), 3);
  assert.equal(extendFeedUrl('https://x.test/ri.ics?sid=1&p=0.m,20270111.x', new Date(2027, 11, 1)), 'https://x.test/ri.ics?sid=1&p=0.m,20271201.x');
  assert.equal(extendFeedUrl('https://x.test/ri.ics?sid=1', new Date(2027, 3, 11)), null);
});

test('sourceStats shows the date range per calendar', () => {
  const evs = parseIcs(ICS, 'a');
  const [a, b] = sourceStats(evs, ['a', 'none']);
  assert.equal(a.count, 3);
  assert.equal(a.first, Date.UTC(2026, 10, 9, 8, 15));
  assert.ok(a.last! > a.first!);
  assert.deepEqual(b, { id: 'none', count: 0 });
});
