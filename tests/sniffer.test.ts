import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SNIFF } from '../src/screens/sniffer.ts';

const LINK = 'https://cloud.timeedit.net/kth/web/stud02/ri.ics?sid=23&objects=525160.47&p=0.m%2C20270111.x&l=sv&e=2611&ku=FAKE&k=FAKE';

function run(page: { els?: Record<string, string>[]; bodyText?: string; copy?: string }) {
  const posted: string[] = [];
  const clip = { writeText: (_: string) => Promise.resolve() };
  const ctx: Record<string, unknown> = {
    document: {
      querySelectorAll: () => page.els ?? [],
      body: { innerText: page.bodyText ?? '' },
      documentElement: {},
      addEventListener: () => {},
    },
    navigator: { clipboard: clip },
    window: {
      ReactNativeWebView: { postMessage: (m: string) => posted.push(m) },
      getSelection: () => '',
      open: () => null,
    },
    MutationObserver: class { observe() {} },
    setInterval: () => 0,
  };
  vm.createContext(ctx);
  vm.runInContext(SNIFF, ctx);
  if (page.copy) clip.writeText(page.copy);
  return posted;
}

test('script is valid and finds links in anchors, inputs and visible text', () => {
  assert.deepEqual(run({ els: [{ href: LINK }] }), [LINK]);
  assert.deepEqual(run({ els: [{ value: `webcal://cloud.timeedit.net/kth/web/stud02/ri.ics?sid=7&k=AB` }] }),
    ['webcal://cloud.timeedit.net/kth/web/stud02/ri.ics?sid=7&k=AB']);
  assert.deepEqual(run({ bodyText: `Copy this link:\n${LINK}\nThen paste it.` }), [LINK]);
});

test('finds links copied to the clipboard, ignores pages without one', () => {
  assert.deepEqual(run({ copy: LINK }), [LINK]);
  assert.deepEqual(run({ bodyText: 'Mitt schema https://cloud.timeedit.net/kth/web/stud02/ri.html' }), []);
});
