import { useToast } from '../utils/toast';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { requestApi, setApiTokens } from '../utils/apiClient';
import { syncNow } from '../utils/apiSync';
import { useAuth } from '../utils/authContext';
import {
  credentialsBody, mapCredentialsFailure, readCredentialsResponse, validateCredentialsChange,
  type CredentialsErrorKey,
} from '../utils/authApi';
import { useI18n } from '../utils/i18n';
import { useTheme } from '../utils/theme';

/** Change the account email and/or password (PUT /api/auth/me), like the web account page. */
export default function AccountScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { signOutUser } = useAuth();
  const router = useRouter();
  const showToast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const messages = { ...t.login, ...t.accountPage } as Record<string, string>;
  const messageFor = (key: CredentialsErrorKey) => messages[key] ?? t.login.authGeneric;

  const handleSave = async () => {
    if (busy) return;
    setSaved(false);
    const form = { currentPassword, newEmail, newPassword, confirmPassword };
    const invalid = validateCredentialsChange(form);
    if (invalid) {
      setError(messageFor(invalid));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // A new email must be confirmed before it can sign in, which closes this session and
      // erases this device's copy: make sure nothing unsynced is lost first.
      if (newEmail.trim()) {
        const synced = await syncNow();
        if (synced.error) {
          setError(t.accountPage.syncFirst);
          return;
        }
      }
      const res = await requestApi('/api/auth/me', { method: 'PUT', body: JSON.stringify(credentialsBody(form)) });
      if (res.status < 200 || res.status >= 300) {
        setError(messageFor(mapCredentialsFailure(res.status)));
        return;
      }
      const outcome = readCredentialsResponse(res.data);
      if (outcome.kind === 'verify') {
        await signOutUser();
        showToast(t.accountPage.verifyEmail, 8000);
        return;
      }
      if (outcome.kind === 'session') await setApiTokens(outcome.token, outcome.refreshToken);
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch {
      setError(t.login.authGeneric);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  const labelStyle = [styles.label, { color: colors.textSecondary }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        headerTitle: t.accountPage.title,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerShadowVisible: false,
      }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t.accountPage.intro}</Text>

        {error && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.message, { color: colors.destructiveText }]}>{error}</Text>}
        {saved && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.message, { color: colors.success }]}>{t.accountPage.saved}</Text>}

        <Text style={labelStyle}>{t.accountPage.currentPassword}</Text>
        <TextInput style={inputStyle} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="current-password" editable={!busy}
          accessibilityLabel={t.accountPage.currentPassword} />

        <Text style={labelStyle}>{t.accountPage.newEmail}</Text>
        <TextInput style={inputStyle} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy}
          accessibilityLabel={t.accountPage.newEmail} />

        <Text style={labelStyle}>{t.accountPage.newPassword}</Text>
        <TextInput style={inputStyle} value={newPassword} onChangeText={setNewPassword} secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy}
          accessibilityLabel={t.accountPage.newPassword} />

        <Text style={labelStyle}>{t.accountPage.confirmPassword}</Text>
        <TextInput style={inputStyle} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry
          autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy}
          onSubmitEditing={handleSave} accessibilityLabel={t.accountPage.confirmPassword} />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={handleSave}
          style={[styles.button, { backgroundColor: colors.accentFill }, busy && { opacity: 0.5 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t.accountPage.save}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back} disabled={busy}>
          <Text style={[styles.backText, { color: colors.accent }]}>{t.config.cancel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  message: { fontSize: 14, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 16 },
  button: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  back: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
});
