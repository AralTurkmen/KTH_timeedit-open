import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { normalizeFeedUrl } from '../core/timeedit.ts';
import { useColors } from '../theme';
import { Btn, Field } from '../ui';

interface Props {
  onBrowse: () => void;
  onAddPasted: (feedUrl: string) => void;
  onBack: () => void;
}

export function AddCourse({ onBrowse, onAddPasted, onBack }: Props) {
  const c = useColors();
  const [paste, setPaste] = useState('');
  const [error, setError] = useState('');

  const addPasted = () => {
    try {
      onAddPasted(normalizeFeedUrl(paste));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Btn kind="plain" title="‹ Back" onPress={onBack} />
      <Text style={[styles.title, { color: c.text }]}>Add courses</Text>

      <Text style={[styles.label, { color: c.text }]}>Option 1: pick them in TimeEdit</Text>
      <Text style={[styles.body, { color: c.sub }]}>
        Search and select your courses, then tap Subscribe. The app captures the calendar link
        for you. You can select several courses and they come as one calendar.
      </Text>
      <Btn title="Open TimeEdit" onPress={onBrowse} />

      <Text style={[styles.label, { color: c.text, marginTop: 28 }]}>Option 2: paste a course calendar link</Text>
      <Field
        value={paste}
        onChangeText={(t) => { setPaste(t); setError(''); }}
        placeholder="https://cloud.timeedit.net/.../ri.ics?..."
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Btn title="Add link" onPress={addPasted} disabled={!paste.trim()} />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', marginVertical: 12 },
  label: { fontWeight: '600', marginBottom: 6 },
  body: { marginBottom: 10 },
  error: { marginTop: 14 },
});
