import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../utils/theme';

export interface FilterOption {
  key: string;
  label: string;
}

export interface FilterGroup {
  key: string;
  label: string;
  /** Key of the selected option; `all` means the filter is off. */
  selectedKey: string;
  options: FilterOption[];
  onSelect: (key: string) => void;
  /** Extra control shown under the options of the open group (e.g. a picker). */
  extra?: React.ReactNode;
}

export interface FilterSection {
  title: string;
  groups: FilterGroup[];
}

export const FILTER_OFF = 'all';

export function selectedLabel(group: FilterGroup): string {
  return group.options.find(o => o.key === group.selectedKey)?.label ?? group.options[0]?.label ?? '';
}

interface FilterPanelProps {
  title: string;
  resultsLabel: string;
  clearLabel: string;
  canClear: boolean;
  onClear: () => void;
  sections: FilterSection[];
}

/**
 * Filters grouped by what they describe, one row per filter showing its current
 * value. A row opens to its options (one open at a time), like the web client.
 */
export default function FilterPanel({ title, resultsLabel, clearLabel, canClear, onClear, sections }: FilterPanelProps) {
  const { colors } = useTheme();
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {title}
          <Text style={[styles.count, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">{`  ·  ${resultsLabel}`}</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canClear }}
          disabled={!canClear}
          onPress={onClear}
          hitSlop={8}
          style={styles.clearBtn}
        >
          <Text style={[styles.clearText, { color: colors.accent }, !canClear && { opacity: 0.4 }]}>{clearLabel}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]} accessibilityRole="header">{section.title}</Text>
            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.groups.map((group, i) => {
                const isOpen = openKey === group.key;
                const applied = group.selectedKey !== FILTER_OFF;
                return (
                  <View key={group.key} style={i > 0 && [styles.rowDivider, { borderTopColor: colors.border }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      accessibilityLabel={`${group.label}: ${selectedLabel(group)}`}
                      onPress={() => setOpenKey(isOpen ? null : group.key)}
                      style={({ pressed }) => [styles.rowHead, pressed && { backgroundColor: colors.surface2 }]}
                    >
                      <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{group.label}</Text>
                      <Text
                        style={[styles.rowValue, { color: applied ? colors.accent : colors.textSecondary }, applied && styles.rowValueApplied]}
                        numberOfLines={1}
                      >
                        {selectedLabel(group)}
                      </Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                    </Pressable>
                    {isOpen && (
                      <View style={[styles.options, { backgroundColor: colors.bg, borderTopColor: colors.border }]} accessibilityRole="radiogroup">
                        {group.options.map(opt => {
                          const selected = group.selectedKey === opt.key;
                          return (
                            <Pressable
                              key={opt.key}
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              onPress={() => group.onSelect(opt.key)}
                              style={({ pressed }) => [
                                styles.option,
                                (selected || pressed) && { backgroundColor: colors.accentSubtle },
                              ]}
                            >
                              <Text style={[styles.optionText, { color: selected ? colors.accent : colors.text }, selected && styles.optionTextSelected]}>
                                {opt.label}
                              </Text>
                              {selected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                            </Pressable>
                          );
                        })}
                        {group.extra}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface ActiveFilterChipsProps {
  chips: { key: string; text: string }[];
  removeLabel: string;
  onRemove: (key: string) => void;
}

/** Applied filters as removable chips, shown while the panel is closed. */
export function ActiveFilterChips({ chips, removeLabel, onRemove }: ActiveFilterChipsProps) {
  const { colors } = useTheme();
  if (chips.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {chips.map(chip => (
        <Pressable
          key={chip.key}
          accessibilityRole="button"
          accessibilityLabel={`${removeLabel}: ${chip.text}`}
          onPress={() => onRemove(chip.key)}
          hitSlop={{ top: 6, bottom: 6 }}
          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.chipText, { color: colors.accent }]} numberOfLines={1}>{chip.text}</Text>
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  count: { fontSize: 14, fontWeight: '400' },
  clearBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { fontSize: 15, fontWeight: '600' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  list: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  rowDivider: { borderTopWidth: 1 },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 14, maxWidth: '50%' },
  rowValueApplied: { fontWeight: '600' },
  options: { borderTopWidth: 1, paddingVertical: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  optionText: { flex: 1, fontSize: 15 },
  optionTextSelected: { fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
