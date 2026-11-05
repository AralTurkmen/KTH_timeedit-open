import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { normalizeFeedUrl } from '../core/timeedit.ts';
import { useColors } from '../theme';
import { Btn, Field } from '../ui';

interface Props {
  onFeed: (url: string) => void;
  onLogin: (startUrl: string) => void;
  /** Present when replacing an existing schedule, so the user can back out. */
  onCancel?: () => void;
}

export function Onboarding({ onFeed, onLogin, onCancel }: Props) {
  const c = useColors();
  const [link, setLink] = useState('');
  const [site, setSite] = useState('');
  const [error, setError] = useState('');

  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {onCancel ? <Btn kind="plain" title="‹ Back" onPress={onCancel} /> : null}
      <Text style={[styles.title, { color: c.text }]}>
        {onCancel ? 'Replace My schedule' : 'Connect TimeEdit'}
      </Text>

      <Text style={[styles.label, { color: c.text }]}>Option 1: paste your calendar (ICS / webcal) link</Text>
      <Field
        value={link}
        onChangeText={(t) => { setLink(t); setError(''); }}
        placeholder="https://cloud.timeedit.net/.../ri.ics?..."
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Btn title="Use link" onPress={() => run(() => onFeed(normalizeFeedUrl(link)))} disabled={!link.trim()} />

      <Text style={[styles.label, { color: c.text, marginTop: 28 }]}>
        Option 2: sign in with your university (SSO)
      </Text>
      <Field
        value={site}
        onChangeText={(t) => { setSite(t); setError(''); }}
        placeholder="https://cloud.timeedit.net/kth/web/stud02/"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Btn title="Open sign-in" onPress={() => run(() => onLogin(normalizeFeedUrl(site)))} disabled={!site.trim()} />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 24 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  error: { marginTop: 16 },
});
