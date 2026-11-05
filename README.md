# timeedit-open

A free, open-source mobile app (Expo / React Native, TypeScript) that shows your
[TimeEdit](https://www.timeedit.com/) schedule and lets you add extra courses.

- Connect with a **calendar (ICS/webcal) link**, or **sign in through your
  university's SSO** inside the app, which picks up the calendar link for you.
- Add **specific courses** by picking them in TimeEdit, or by pasting a course calendar link.
- Merges everything into one agenda, de-duplicated, with an offline cache.
- **Agenda and week views.** The week view is a Monday-to-Sunday time grid; tap an event for details.
- **Per-course colours** and **hide individual courses** (Settings). Hidden courses disappear from both views.
- **Dark / light / system theme.**
- **ISO week numbers** (as used in Sweden) in the week view and in the agenda.
- **KTH room finder:** tap a room name on an event to open KTH Places inside the app, with the
  room's address, building, floor and room number shown on top. After the first visit the details, floor plan and photos are saved for offline use.
- **Replace My schedule** (Settings) when you get a new link, e.g. a new semester. Added courses and settings are kept.
- No accounts, no server, no tracking. Your links are stored only on your device.

## Project layout

```
App.tsx                  app state and wiring
src/core/                pure TypeScript, no dependencies, unit-tested
  ics.ts                 ICS parser (time zones, all-day, cancelled events)
  timeedit.ts            URL helpers, link expiry, feed fetching
  merge.ts               merge / group / filter events
  prefs.ts               theme, hidden courses, colours, validation
  week.ts                week grid layout, ISO week number
  rooms.ts               room-name splitting, KTH Places URLs, room text parser
src/screens/             Onboarding, LoginWebView, Schedule, WeekView, Settings, AddCourse
src/theme.ts, ui.tsx     colour palettes and small themed components
src/storage.ts           AsyncStorage persistence
tests/core.test.ts       tests for src/core
assets/                  App icons
```

## Run it

To use the source code in this repo: Create an Expo project, then copy it in so
dependency versions match your Expo SDK:

```bash
npx create-expo-app@latest timeedit-open --template blank-typescript
cd timeedit-open
# copy App.tsx, src/, tests/, assets/, tsconfig.json, LICENSE from this repo over the new project
npx expo install react-native-webview @react-native-async-storage/async-storage react-native-url-polyfill react-native-safe-area-context
npx expo start
```

For the **System** theme option to follow your phone, set `"userInterfaceStyle": "automatic"` in
your project's `app.json` (the blank template sets `"light"`). Without it, System stays light;
the explicit Light and Dark options work either way.

Run the core tests (Node 22.6+, no install needed):

```bash
node --experimental-strip-types --test tests/core.test.ts tests/sniffer.test.ts tests/prefs.test.ts
```

## Build an installable APK (Android)

The Expo Go app is only for testing. To get a normal app you can install and share:

1. In your Expo project's `app.json`, merge in the keys from `app.json.example`: a unique
   `android.package` (e.g. `com.yourname.timeeditopen`), and `"userInterfaceStyle": "automatic"`.
   Keep the `icon`/`splash` entries your project already has.
2. Copy `eas.json` from this repo into the project folder.
3. Run:
   ```bash
   npm install -g eas-cli
   eas login            # free Expo account
   eas build -p android --profile preview
   ```
   EAS builds in the cloud (a few minutes, queue times vary on the free plan) and prints a
   download link for the `.apk`. Open it on your phone and allow "install unknown apps".
4. Alternative without an Expo account: install Android Studio, then `npx expo prebuild -p android`
   and `cd android && ./gradlew assembleRelease`; the APK ends up in `android/app/build/outputs/apk/release/`.

The `preview` profile produces a directly installable `.apk`. The `production` profile makes an
`.aab` for the Play Store, which you do not need.

## Missing events at the end of a link's date range

A subscribe link only contains events up to its end date (`p=0.m,YYYYMMDD.x`). If events on that
last day are missing, the end date is probably exclusive. Settings, under Calendars, shows how many
events each calendar delivered and the first and last date, so you can see where a feed stops. Make
a new Subscribe link in TimeEdit with a later end date (or try "Extend the end date" in Settings).
Exams are sometimes not part of "My schedule" at all; if they are still missing with a later end
date, add the exam schedule from TimeEdit through Add courses.

## How it talks to TimeEdit

TimeEdit can publish any schedule as an iCalendar feed. Most universities show a
"Subscribe" link under a schedule; that link is what this app consumes. Example
shape (KTH): `https://cloud.timeedit.net/kth/web/stud02/ri.ics?sid=..&objects=..&p=0.m%2C20270111.x&ku=..&k=..`

- **Personal schedule (SSO):** the sign-in screen opens your TimeEdit site in a WebView.
  After you log in and tap "Subscribe", the app captures the `.ics` link. It carries
  a personal token (`ku`, `k`), so it keeps working without logging in again.
  Treat it like a password: anyone with the link can read your schedule.
- **Adding courses:** the app opens TimeEdit so you can pick courses and tap Subscribe, or
  you can paste a course link. Each is stored as its own calendar and merged.
- **Expiry:** the link's end date is encoded in `p=` (e.g. `20270111`). The app warns
  two weeks before it ends and has a Renew button that re-opens TimeEdit.
- **Why links are not edited by the app:** TimeEdit appends a `k=` value that looks like a
  signature over the other parameters, so rewriting `objects=` would likely be rejected.

### Room lookup (KTH Places)

Tapping a room the first time opens `kth.se/places` search for that room code inside the app.
Tap the right result once. While the page is open the app reads its text (address, building,
floor, room number), the floor-plan image and the room photo addresses, and saves them on your
device. From then on that room opens in a native **saved view**: the facts, a zoomable floor
plan that works offline, and photos, with an "Open on kth.se" button to refresh it.

Only rooms you open yourself are saved; the app does not search or crawl kth.se on its own.
Floor-plan images over about 1 MB are not stored (the page address still is). Other universities
can be supported by changing the URLs and labels in `src/core/rooms.ts`.

### Known limitations

- **Not yet tested against a live TimeEdit instance or on a device.** The core
  (parser, time zones, expiry, merging) is unit-tested using the shape of real KTH links;
  the WebView link capture (`src/screens/sniffer.ts`, tested only against a stub page) is the part most likely to need
  adjusting for your university's page. If it does not pick up the link, paste it instead.
- Room lookup depends on the layout of kth.se pages (labels such as `Lokalkod`, the floor-plan path `/places/floorplan/`, photos from `facility.admin.kth.se`). If KTH changes them, saved details may stay empty, but the page itself still works.
- Recurring-event rules (RRULE) are not expanded; TimeEdit lists each occurrence as its own event.
- Refreshes happen on app start and pull-to-refresh only. Check your university's terms
  before publishing the app widely.
- Never commit real feed links (they contain tokens) to the repo or to issues.

## Ideas for contributions

Home-screen widget, notifications before lectures, per-course colors, hiding
individual courses, week view, iOS/Android calendar export.

## License

MIT
