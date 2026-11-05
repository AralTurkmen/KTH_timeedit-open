import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ROOM_SNIFF, SCROLL_TO_PLAN } from '../src/screens/roomScript.ts';
import { parseRoomText, roomIdFromUrl } from '../src/core/rooms.ts';

const PLAN = 'https://www.kth.se/places/floorplan/636e3d88-a74b-4546-bd2f-103754a40f60/5623';
const URL_ = 'https://www.kth.se/places/room/id/0e2af584-d1d1-40c8-83b1-e3fdb285dcc5';
const TEXT = 'V3, Teknikringen 72\nHörsal\nAdress: Teknikringen 72\nRumsnr: 203Lokalkod: V3Vån: 05\nByggnad: V-huset,Campus: KTH Campus';

function ctx(extra: Record<string, unknown> = {}) {
  const posted: string[] = [];
  const scrolled: string[] = [];
  const c: Record<string, unknown> = {
    document: {
      body: { innerText: TEXT },
      querySelector: (sel: string) => (sel.includes('/places/floorplan/') ? { src: PLAN, scrollIntoView: () => scrolled.push('x') } : null),
      querySelectorAll: () => [{ src: 'https://facility.admin.kth.se/x/V3-01.jpg' }],
    },
    fetch: (u: string) => Promise.resolve({ blob: () => Promise.resolve({ size: u.includes('big') ? 5_000_000 : 1234 }) }),
    FileReader: class { onload: (() => void) | null = null; result = 'data:image/png;base64,AAAA'; readAsDataURL() { this.onload?.(); } },
    location: { href: URL_ },
    window: { ReactNativeWebView: { postMessage: (m: string) => posted.push(m) } },
    setInterval: () => 0,
    ...extra,
  };
  vm.createContext(c);
  return { c, posted, scrolled };
}

test('room script reports url, text, floor plan and photos; app can parse it', async () => {
  const { c, posted } = ctx();
  vm.runInContext(ROOM_SNIFF, c);
  await new Promise((r) => setTimeout(r, 10));
  const m = JSON.parse(posted[0]);
  assert.equal(m.kind, 'page');
  assert.deepEqual(m.photos, ['https://facility.admin.kth.se/x/V3-01.jpg']);
  // the floor plan image itself follows as a separate message
  const plan = posted.map((x) => JSON.parse(x)).find((x) => x.kind === 'plan');
  assert.equal(plan.planUrl, PLAN);
  assert.equal(plan.data, 'data:image/png;base64,AAAA');
  assert.equal(roomIdFromUrl(plan.url), '0e2af584-d1d1-40c8-83b1-e3fdb285dcc5');
  assert.equal(m.floorplan, PLAN);
  assert.equal(roomIdFromUrl(m.url), '0e2af584-d1d1-40c8-83b1-e3fdb285dcc5');
  assert.equal(parseRoomText(m.text).code, 'V3');
});

test('room script tolerates a page without a floor plan, and scroll script finds the image', () => {
  const { c, posted } = ctx({
    document: { body: { innerText: 'x' }, querySelector: () => null, querySelectorAll: () => [] },
  });
  vm.runInContext(ROOM_SNIFF, c);
  assert.equal(JSON.parse(posted[0]).floorplan, null);
  assert.equal(posted.length, 1); // no floor plan, so no image message

  const s = ctx();
  vm.runInContext(SCROLL_TO_PLAN, s.c);
  assert.equal(s.scrolled.length, 1);
});

test('oversized floor plans are not sent as data', async () => {
  const BIG = 'https://www.kth.se/places/floorplan/big/1';
  const { c, posted } = ctx({
    document: { body: { innerText: 'x' }, querySelector: () => ({ src: BIG }), querySelectorAll: () => [] },
  });
  vm.runInContext(ROOM_SNIFF, c);
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(!posted.some((x) => JSON.parse(x).kind === 'plan'));
  assert.equal(JSON.parse(posted[0]).floorplan, BIG); // the address is still reported
});
