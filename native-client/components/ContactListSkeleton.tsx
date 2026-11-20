import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useI18n } from '../utils/i18n';
import { useTheme } from '../utils/theme';

const ROWS = [
  [140, 90], [110, 70], [160, 100], [120, 80], [150, 60], [100, 90], [130, 70], [145, 85],
];

/** Placeholder rows shaped like the contact list while it loads; still when motion is reduced. */
export default function ContactListSkeleton() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const pulse = useRef(new Animated.Value(0.45)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const block = { backgroundColor: colors.border };
  const opacity = reduceMotion ? 0.6 : pulse;

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t.config.loading} importantForAccessibility="yes">
      {ROWS.map(([nameWidth, lineWidth], i) => (
        <Animated.View key={i} style={[styles.row, { backgroundColor: colors.surface, opacity }]}>
          <View style={[styles.avatar, block]} />
          <View style={styles.lines}>
            <View style={[styles.line, block, { width: nameWidth }]} />
            <View style={[styles.line, styles.second, block, { width: lineWidth }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 68 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  lines: { flex: 1, gap: 8 },
  line: { height: 12, borderRadius: 6 },
  second: { height: 10 },
});
