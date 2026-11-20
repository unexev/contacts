import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../utils/theme';

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** A labelled checkbox with a 44px touch target. */
export default function CheckboxRow({ label, value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={styles.row}
      onPress={() => onChange(!value)}
    >
      <View style={[styles.box, { borderColor: colors.border }, value && { backgroundColor: colors.accentFill, borderColor: colors.accentFill }]}>
        {value && <Ionicons name="checkmark" size={14} color={colors.surface} />}
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, marginTop: 16 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15 },
});
