import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../utils/i18n';
import { useResponsive } from '../utils/responsive';
import { useTheme } from '../utils/theme';

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const isCalendar = pathname.startsWith('/calendar');
  const isMenu = pathname.startsWith('/menu');
  const isContacts = !isCalendar && !isMenu && (pathname === '/' || pathname === '/index' || pathname.startsWith('/(tabs)'));

  if (isDesktop && Platform.OS === 'web') return null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, backgroundColor: colors.surface, borderTopColor: colors.separator }]}>
      <Pressable accessibilityRole="tab" accessibilityLabel={t.tabs.contacts} accessibilityState={{ selected: isContacts }} style={styles.tab} onPress={() => router.push('/(tabs)')}>
        <Ionicons name="person-circle-outline" size={24} color={colors.accent} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.label, { color: colors.accent }]}>{t.tabs.contacts}</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel={t.tabs.calendar} accessibilityState={{ selected: isCalendar }} style={styles.tab} onPress={() => router.push('/(tabs)/calendar')}>
        <Ionicons name="calendar-outline" size={24} color={colors.accent} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.label, { color: colors.accent }]}>{t.tabs.calendar}</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityLabel={t.tabs.menu} accessibilityState={{ selected: isMenu }} style={styles.tab} onPress={() => router.push('/(tabs)/menu')}>
        <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={colors.accent} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.label, { color: colors.accent }]}>{t.tabs.menu}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10,
  },
  label: {
    fontSize: 11, marginTop: 3,
  },
});
