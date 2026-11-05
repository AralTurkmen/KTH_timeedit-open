import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitRooms, roomSearchUrl, roomPageUrl, roomIdFromUrl, parseRoomText, sameRoom, roomKey,
} from '../src/core/rooms.ts';
import { isoWeek } from '../src/core/week.ts';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

test('isoWeek matches the Swedish week numbering', () => {
  assert.deepEqual(isoWeek(at(2026, 11, 2)), { week: 45, year: 2026 });
  assert.deepEqual(isoWeek(at(2026, 11, 8)), { week: 45, year: 2026 });
  assert.deepEqual(isoWeek(at(2026, 11, 16)), { week: 47, year: 2026 });
  assert.deepEqual(isoWeek(at(2026, 1, 1)), { week: 1, year: 2026 });
  assert.deepEqual(isoWeek(at(2025, 12, 29)), { week: 1, year: 2026 }); // Monday of ISO week 1
  assert.deepEqual(isoWeek(at(2024, 12, 30)), { week: 1, year: 2025 });
  assert.deepEqual(isoWeek(at(2021, 1, 3)), { week: 53, year: 2020 }); // 2020 has 53 weeks
  assert.deepEqual(isoWeek(at(2026, 3, 29)), { week: 13, year: 2026 }); // around the DST change
  assert.deepEqual(isoWeek(at(2026, 3, 30)), { week: 14, year: 2026 });
});

test('splitRooms', () => {
  assert.deepEqual(splitRooms('V3'), ['V3']);
  assert.deepEqual(splitRooms('Q31, Q32;  Q33'), ['Q31', 'Q32', 'Q33']);
  assert.deepEqual(splitRooms('V3 (Teknikringen 72)'), ['V3']);
  assert.deepEqual(splitRooms('D1, d1'), ['D1']);
  assert.deepEqual(splitRooms(''), []);
});

test('room urls', () => {
  assert.equal(
    roomSearchUrl('V3'),
    'https://www.kth.se/search?q=V3&entityFilter=kth-place&filterLabel=Lokaler&lang=sv&btnText=&activeTab=webpages',
  );
  assert.match(roomSearchUrl('M 1/2'), /q=M%201%2F2&/);
  const id = '0e2af584-d1d1-40c8-83b1-e3fdb285dcc5';
  assert.equal(roomPageUrl(id), `https://www.kth.se/places/room/id/${id}`);
  assert.equal(roomIdFromUrl(`https://www.kth.se/places/room/id/${id}?l=en`), id);
  assert.equal(roomIdFromUrl(`https://kth.se/places/room/id/${id.toUpperCase()}`), id);
  assert.equal(roomIdFromUrl('https://www.kth.se/places/floorplan/636e3d88-a74b-4546-bd2f-103754a40f60/5623'), null);
  assert.equal(roomIdFromUrl('https://www.kth.se/search?q=V3'), null);
  assert.equal(roomKey(' v3 '), 'V3');
});

test('parseRoomText reads the text as pasted from the KTH page (labels run together)', () => {
  const pasted = 'Hörsal\nAdress: Teknikringen 72\nRumsnr: 203Lokalkod: V3Vån: 05\nByggnad: V-huset,Campus: KTH Campus';
  assert.deepEqual(parseRoomText(pasted), {
    type: 'Hörsal', address: 'Teknikringen 72', number: '203', code: 'V3', floor: '05',
    building: 'V-huset', campus: 'KTH Campus',
  });
  // with page chrome before it and noise after it
  const noisy = 'KTH\nMenu\nV3, Teknikringen 72\n' + pasted + '\nAntal platser: 72\nRitning';
  const n = parseRoomText(noisy);
  assert.equal(n.code, 'V3');
  assert.equal(n.campus, 'KTH Campus');
  assert.equal(n.type, 'Hörsal');
});

test('parseRoomText handles English labels, missing fields and junk', () => {
  assert.deepEqual(
    parseRoomText('Seminar room\nAddress: Brinellvägen 8\nRoom code: 4523\nFloor: 02'),
    { type: 'Seminar room', address: 'Brinellvägen 8', code: '4523', floor: '02' },
  );
  assert.deepEqual(parseRoomText('nothing useful here'), {});
  assert.deepEqual(parseRoomText(''), {});
  assert.ok(sameRoom('V 3', 'v3'));
  assert.ok(!sameRoom('V3', 'V31'));
});
