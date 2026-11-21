import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../utils/i18n';
import { useTheme } from '../../utils/theme';

interface Props {
  /** Names of the sections inside, shown as a summary while collapsed. */
  summary: string;
  count: number;
  children: React.ReactNode;
}

/** Holds the cards the contact has no data for yet, so they do not bury the ones that matter. */
export default function MoreDetails({ summary, count, children }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${t.detail.moreDetails} (${count})`}
        accessibilityHint={summary}
        onPress={() => setOpen(v => !v)}
        style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.texts}>
          <Text style={[styles.title, { color: colors.accent }]}>{t.detail.moreDetails} ({count})</Text>
          {!open && <Text numberOfLines={2} style={[styles.summary, { color: colors.textSecondary }]}>{summary}</Text>}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },
  texts: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  summary: { fontSize: 13, marginTop: 2 },
  body: { marginTop: 0 },
});
