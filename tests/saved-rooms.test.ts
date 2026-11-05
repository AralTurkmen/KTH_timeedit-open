import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRooms, mergeRecord, hasDetails, planHtml, isPlanDataUrl, isKthUrl, cleanInfo, MAX_PLAN_CHARS,
} from '../src/core/rooms.ts';

const ID = '0e2af584-d1d1-40c8-83b1-e3fdb285dcc5';
const ID2 = '636e3d88-a74b-4546-bd2f-103754a40f60';
const PLAN = 'https://www.kth.se/places/floorplan/636e3d88-a74b-4546-bd2f-103754a40f60/5623';
const PHOTO = 'https://facility.admin.kth.se/Undervisningslokaler/Bilder_API/A0043011/V3/V3-01.jpg';

test('normalizeRooms migrates the old id-only format and drops junk', () => {
  assert.deepEqual(normalizeRooms({ V3: ID.toUpperCase(), BAD: 'nope', X: 5 }), { V3: { id: ID } });
  assert.deepEqual(normalizeRooms(null), {});
  assert.deepEqual(normalizeRooms('x'), {});
  const rec = normalizeRooms({
    V3: { id: ID, info: { code: 'V3', floor: '05', evil: 'x', address: 7 }, planUrl: PLAN, photos: [PHOTO, 'http://evil.test/a.jpg', 3] },
  });
  assert.deepEqual(rec, { V3: { id: ID, info: { code: 'V3', floor: '05' }, planUrl: PLAN, photos: [PHOTO] } });
  assert.deepEqual(normalizeRooms({ V3: { id: ID, planUrl: 'https://evil.test/x' } }), { V3: { id: ID } });
});

test('mergeRecord keeps good data, replaces it with better data, resets on another room', () => {
  const first = mergeRecord(undefined, { id: ID, info: { code: 'V3', floor: '05' }, planUrl: PLAN, photos: [PHOTO] });
  assert.deepEqual(first, { id: ID, info: { code: 'V3', floor: '05' }, planUrl: PLAN, photos: [PHOTO] });
  // an empty parse must not wipe what we had
  assert.deepEqual(mergeRecord(first, { id: ID, info: {}, photos: [] }), first);
  // new info replaces old
  assert.equal(mergeRecord(first, { id: ID, info: { code: 'V3', floor: '06' } }).info?.floor, '06');
  // a different page id starts fresh
  assert.deepEqual(mergeRecord(first, { id: ID2 }), { id: ID2 });
  assert.equal(hasDetails({ id: ID }), false);
  assert.equal(hasDetails(first), true);
  assert.equal(hasDetails(undefined), false);
});

test('only safe image sources are accepted and html is escaped', () => {
  const data = 'data:image/png;base64,iVBORw0KGgo=';
  assert.ok(isPlanDataUrl(data));
  assert.ok(!isPlanDataUrl('data:text/html;base64,AAAA'));
  assert.ok(!isPlanDataUrl('data:image/png;base64,' + 'A'.repeat(MAX_PLAN_CHARS)));
  assert.ok(isKthUrl(PLAN) && isKthUrl(PHOTO));
  assert.ok(!isKthUrl('https://kth.se.evil.test/x') && !isKthUrl('http://www.kth.se/x'));
  assert.match(planHtml(data), /<img src="data:image\/png;base64,iVBORw0KGgo=">/);
  assert.equal(planHtml('javascript:alert(1)'), '');
  assert.equal(planHtml('https://evil.test/a.png'), '');
  assert.equal(planHtml('https://www.kth.se/a"><script>x</script>'), planHtml('https://www.kth.se/a"><script>x</script>'));
  assert.ok(!planHtml('https://www.kth.se/a"><script>x</script>').includes('<script>'));
  assert.equal(cleanInfo({ code: '  ' }), undefined);
});
