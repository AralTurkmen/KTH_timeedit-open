import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import { useColors } from './theme';

interface BtnProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'plain' | 'danger';
}

export function Btn({ title, onPress, disabled, kind = 'primary' }: BtnProps) {
  const c = useColors();
  const filled = kind === 'primary';
  const fg = filled ? c.onAccent : kind === 'danger' ? c.danger : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: filled ? c.accent : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? c.accent : c.card, borderColor: selected ? c.accent : c.border }]}
    >
      <Text style={{ color: selected ? c.onAccent : c.text, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.sub}
      {...props}
      style={[styles.field, { color: c.text, borderColor: c.border, backgroundColor: c.card }, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '600', fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  field: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
});
