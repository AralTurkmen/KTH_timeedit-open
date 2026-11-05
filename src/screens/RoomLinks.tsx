import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { splitRooms } from '../core/rooms.ts';
import { useColors } from '../theme';

/** A row of tappable room names taken from an event's location. */
export function RoomLinks({ location, onRoom, small }: { location: string; onRoom: (room: string) => void; small?: boolean }) {
  const c = useColors();
  const rooms = splitRooms(location);
  if (!rooms.length) return null;
  return (
    <View style={styles.row}>
      {rooms.map((r) => (
        <Pressable
          key={r}
          accessibilityRole="link"
          accessibilityLabel={`Show room ${r}`}
          onPress={() => onRoom(r)}
          style={[styles.pill, { borderColor: c.accent }]}
        >
          <Text style={{ color: c.accent, fontSize: small ? 12 : 13, fontWeight: '600' }}>{r} ›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
});
