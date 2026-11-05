export class NeedsLoginError extends Error {
  constructor() {
    super('The server did not return a calendar. You probably need to sign in again.');
    this.name = 'NeedsLoginError';
  }
}

/** Accept webcal:// links and trim whitespace; throw if it is not an http(s) URL. */
export function normalizeFeedUrl(input: string): string {
  const s = input.trim().replace(/^webcal:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(s)) throw new Error('That does not look like a link.');
  const u = new URL(s);
  if (u.protocol === 'http:') u.protocol = 'https:';
  return u.toString();
}

/** `https://cloud.timeedit.net/kth/web/stud02/ri.ics?x=1` -> `https://cloud.timeedit.net/kth/web/stud02/` */
export function baseFromFeedUrl(feedUrl: string): string {
  const u = new URL(feedUrl);
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
  return u.toString();
}

/**
 * TimeEdit subscription links carry their end date in `p`, e.g. `0.m,20270111.x`.
 * Returns the end of that day (local time), or null if there is none.
 *
 * Do NOT rewrite other query parameters of a feed link (such as `objects`):
 * TimeEdit appends a `k=` value that appears to be a signature over them.
 */
export function feedExpiry(feedUrl: string): Date | null {
  try {
    const p = new URL(feedUrl).searchParams.get('p');
    const m = p ? /,(\d{4})(\d{2})(\d{2})\.x/.exec(p) : null;
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59) : null;
  } catch {
    return null;
  }
}

/** True if the link has ended, or ends within `withinDays` of `now`. */
export function feedExpiresSoon(feedUrl: string, now: number, withinDays = 14): boolean {
  const end = feedExpiry(feedUrl);
  return end !== null && end.getTime() < now + withinDays * 24 * 3600 * 1000;
}

export interface FetchOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

async function getText(url: string, opts: FetchOptions): Promise<string> {
  const f = opts.fetchFn ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    // credentials: 'include' lets the native cookie jar (shared with the login WebView) apply.
    const res = await f(url, { credentials: 'include', signal: ctrl.signal });
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Download an ICS feed. Throws NeedsLoginError if the response is not a calendar. */
export async function fetchFeed(url: string, opts: FetchOptions = {}): Promise<string> {
  const text = await getText(url, opts);
  if (!/^\s*BEGIN:VCALENDAR/i.test(text)) throw new NeedsLoginError();
  return text;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Return `feedUrl` with the end date in its `p=` parameter replaced, touching nothing else.
 * Returns null if the link has no end date. Whether TimeEdit accepts the edited link
 * (it may check a signature) is only known by trying it, see App.extendSource.
 */
export function extendFeedUrl(feedUrl: string, end: Date): string | null {
  const re = /([?&]p=[^&]*?(?:%2C|,))\d{8}(\.x)/i;
  if (!re.test(feedUrl)) return null;
  const ymd = `${end.getFullYear()}${pad2(end.getMonth() + 1)}${pad2(end.getDate())}`;
  return feedUrl.replace(re, `$1${ymd}$2`);
}
