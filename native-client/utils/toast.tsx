import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

type ShowToast = (message: string, ms?: number) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** Non-blocking confirmation ("Number copied"): one message at a time, gone after `ms`. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback<ShowToast>((text, ms = 2000) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), ms);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {!!message && (
        // Above the tab bar; screen readers announce it without taking focus.
        <View pointerEvents="none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 72 }]}>
          <View style={[styles.toast, { backgroundColor: colors.text }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text style={[styles.text, { color: colors.bg }]}>{message}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { maxWidth: 480, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  text: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
