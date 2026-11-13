import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useAuth } from '../utils/authContext';
import { useI18n } from '../utils/i18n';
import { useTheme } from '../utils/theme';

interface EmailLoginFormProps {
  /** Reports a translated error message, or null to clear it. The parent screen renders it. */
  onError: (message: string | null) => void;
}

/** Email/password sign-in and registration form shared by every login screen. */
export default function EmailLoginForm({ onError }: EmailLoginFormProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { loginWithPassword, registerWithPassword } = useAuth();
  const [registerMode, setRegisterMode] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async () => {
    if (busy) return;
    onError(null);
    setBusy(true);
    try {
      const result = registerMode
        ? await registerWithPassword(email, name, password)
        : await loginWithPassword(email, password);
      if (!result.ok) onError(t.login[result.errorKey]);
    } catch {
      // Storing the session can still throw after a successful request.
      onError(t.login.authGeneric);
    } finally {
      setBusy(false);
    }
  };

  const toggleMode = () => {
    onError(null);
    setRegisterMode((m) => !m);
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.textSecondary, backgroundColor: colors.bg }];
  const submitLabel = registerMode ? t.login.createAccount : t.login.signInWithEmail;

  return (
    <>
      {registerMode && (
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder={t.login.nameLabel}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t.login.nameLabel}
          autoCapitalize="words"
          autoComplete="name"
          editable={!busy}
        />
      )}
      <TextInput
        style={inputStyle}
        value={email}
        onChangeText={setEmail}
        placeholder={t.login.emailLabel}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={t.login.emailLabel}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        editable={!busy}
      />
      <TextInput
        style={inputStyle}
        value={password}
        onChangeText={setPassword}
        placeholder={t.login.passwordLabel}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={t.login.passwordLabel}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={registerMode ? 'new-password' : 'current-password'}
        secureTextEntry
        editable={!busy}
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
      />
      <Pressable
        style={[styles.primaryBtn, { backgroundColor: colors.accentFill }, busy && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: busy, busy }}
      >
        {busy
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>{submitLabel}</Text>}
      </Pressable>
      <Pressable style={styles.toggleBtn} onPress={toggleMode} disabled={busy} accessibilityRole="button">
        <Text style={[styles.toggleBtnText, { color: colors.accent }]}>
          {registerMode ? t.login.switchToSignIn : t.login.switchToRegister}
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  input: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, marginBottom: 10 },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 6, minHeight: 44, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleBtn: { width: '100%', alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  toggleBtnText: { fontSize: 15, fontWeight: '500' },
});
