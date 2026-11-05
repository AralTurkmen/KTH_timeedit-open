import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  hasDetails, isPlanDataUrl, parseRoomText, planHtml, roomIdFromUrl, roomPageUrl, roomSearchUrl, sameRoom,
  type RoomInfo, type RoomRecord,
} from '../core/rooms.ts';
import { loadPlan, savePlan } from '../storage';
import { useColors } from '../theme';
import { Btn } from '../ui';
import { ROOM_SNIFF, SCROLL_TO_PLAN } from './roomScript.ts';

interface Props {
  room: string;
  /** Everything remembered about this room from earlier visits, if anything. */
  record?: RoomRecord;
  onSave: (room: string, patch: RoomRecord) => void;
  onBack: () => void;
}

const FIELDS: [keyof RoomInfo, string][] = [
  ['address', 'Address'],
  ['building', 'Building'],
  ['floor', 'Floor'],
  ['number', 'Room number'],
  ['campus', 'Campus'],
];

export function RoomScreen({ room, record, onSave, onBack }: Props) {
  const [mode, setMode] = useState<'saved' | 'web'>(() => (hasDetails(record) ? 'saved' : 'web'));
  const goWeb = () => setMode('web');
  const goSaved = () => setMode('saved');
  return mode === 'saved' && record ? (
    <SavedRoom room={room} record={record} onBack={onBack} onOpenWeb={goWeb} />
  ) : (
    <WebRoom room={room} record={record} onSave={onSave} onBack={onBack} onSavedView={hasDetails(record) ? goSaved : undefined} />
  );
}

function SavedRoom({ room, record, onBack, onOpenWeb }: { room: string; record: RoomRecord; onBack: () => void; onOpenWeb: () => void }) {
  const c = useColors();
  const [plan, setPlan] = useState<string | null>(null);
  const [badPhotos, setBadPhotos] = useState<string[]>([]);
  useEffect(() => {
    loadPlan(record.id).then(setPlan);
  }, [record.id]);

  const info = record.info ?? {};
  const planSrc = plan ?? record.planUrl ?? '';
  const html = planHtml(planSrc);
  const photos = (record.photos ?? []).filter((p) => !badPhotos.includes(p));

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Btn kind="plain" title="‹ Back" onPress={onBack} />
      <Text style={[styles.title, { color: c.text }]}>{room}</Text>
      {info.type ? <Text style={{ color: c.sub, marginBottom: 8 }}>{info.type}</Text> : null}

      {FIELDS.filter(([k]) => info[k]).map(([k, label]) => (
        <View key={k} style={[styles.fact, { borderColor: c.border }]}>
          <Text style={{ color: c.sub, width: 110 }}>{label}</Text>
          <Text style={{ color: c.text, flex: 1, fontWeight: '600' }}>{info[k]}</Text>
        </View>
      ))}

      {html ? (
        <>
          <Text style={[styles.h, { color: c.text }]}>Floor plan</Text>
          <View style={[styles.plan, { borderColor: c.border }]}>
            <WebView
              originWhitelist={['*']}
              source={{ html }}
              scalesPageToFit
              nestedScrollEnabled
              style={{ backgroundColor: '#fff' }}
            />
          </View>
          <Text style={{ color: c.sub, fontSize: 12, marginTop: 4 }}>
            {isPlanDataUrl(plan) ? 'Saved on this phone · pinch to zoom' : 'Loaded from kth.se · open the page once while online to save it'}
          </Text>
        </>
      ) : null}

      {photos.length ? (
        <>
          <Text style={[styles.h, { color: c.text }]}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((p) => (
              <Image
                key={p}
                source={{ uri: p }}
                style={styles.photo}
                onError={() => setBadPhotos((b) => [...b, p])}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={{ marginTop: 24 }}>
        <Btn title="Open on kth.se (updates this info)" onPress={onOpenWeb} />
      </View>
    </ScrollView>
  );
}

function WebRoom({
  room, record, onSave, onBack, onSavedView,
}: { room: string; record?: RoomRecord; onSave: Props['onSave']; onBack: () => void; onSavedView?: () => void }) {
  const c = useColors();
  const web = useRef<WebView>(null);
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const scrolled = useRef(false);
  const knownId = record?.id;
  const startUrl = knownId ? roomPageUrl(knownId) : roomSearchUrl(room);

  const scrollToPlan = () => web.current?.injectJavaScript(SCROLL_TO_PLAN);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { kind?: string; url?: string; text?: string; floorplan?: string | null; photos?: string[]; planUrl?: string; data?: string };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    const id = m.url ? roomIdFromUrl(m.url) : null;

    if (m.kind === 'plan') {
      if (id && isPlanDataUrl(m.data)) savePlan(id, m.data).catch(() => {});
      return;
    }
    if (!id) {
      setInfo(null);
      setHasPlan(false);
      return;
    }
    const parsed = parseRoomText(m.text ?? '');
    setInfo(parsed);
    setHasPlan(!!m.floorplan);
    // Save when we are on the page of the room we looked for.
    if (!parsed.code || sameRoom(parsed.code, room)) {
      onSave(room, { id, info: parsed, planUrl: m.floorplan ?? undefined, photos: m.photos });
    }
  };

  // For a room remembered without details, jump straight to the floor plan once it has loaded.
  useEffect(() => {
    if (knownId && hasPlan && !scrolled.current) {
      scrolled.current = true;
      setTimeout(scrollToPlan, 400);
    }
  }, [hasPlan, knownId]);

  const facts = info
    ? [info.address, info.building, info.floor ? `Floor ${info.floor}` : null, info.number ? `Room ${info.number}` : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <View style={styles.fill}>
      <View style={[styles.top, { borderColor: c.border }]}>
        <Btn kind="plain" title="‹ Back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
            {room}
            {info?.type ? ` · ${info.type}` : ''}
          </Text>
          <Text style={{ color: c.sub, fontSize: 12 }}>
            {facts || (knownId ? 'Loading…' : `Tap the right result for ${room}. It is saved in the app after that.`)}
          </Text>
        </View>
        {onSavedView ? <Btn kind="plain" title="Saved view" onPress={onSavedView} /> : null}
        {hasPlan ? <Btn title="Floor plan" onPress={scrollToPlan} /> : null}
      </View>
      <WebView
        ref={web}
        style={styles.fill}
        source={{ uri: startUrl }}
        injectedJavaScript={ROOM_SNIFF}
        onMessage={onMessage}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  fact: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  plan: { height: 420, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  photo: { width: 220, height: 150, borderRadius: 10, marginRight: 10, backgroundColor: '#ddd' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});
