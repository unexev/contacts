import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useAuth } from '../utils/authContext';
import { API_BASE } from '../utils/apiClient';
import { resendVerificationRequest } from '../utils/authApi';
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
  const [pendingVerify, setPendingVerify] = React.useState(false);
  const [resendNote, setResendNote] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    if (busy) return;
    onError(null);
    setBusy(true);
    try {
      const result = registerMode
        ? await registerWithPassword(email, name, password)
        : await loginWithPassword(email, password);
      if (!result.ok && result.errorKey === 'authVerificationRequired') {
        setResendNote(null);
        setPendingVerify(true);
      } else if (!result.ok) {
        onError(t.login[result.errorKey]);
      }
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

  const handleResend = async () => {
    if (busy) return;
    setBusy(true);
    setResendNote(null);
    try {
      const r = await resendVerificationRequest(fetch, API_BASE, email, password);
      setResendNote(
        r.ok ? t.login.verifyResent
          : r.reason === 'wait' ? t.login.verifyResendWait
          : r.reason === 'done' ? t.login.verifyAlreadyDone
          : t.login.verifyResendFailed
      );
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.textSecondary, backgroundColor: colors.bg }];
  const submitLabel = registerMode ? t.login.createAccount : t.login.signInWithEmail;

  if (pendingVerify) {
    return (
      <>
        <Text style={[styles.verifyTitle, { color: colors.text }]}>{t.login.verifyTitle}</Text>
        <Text style={[styles.verifyText, { color: colors.textSecondary }]}>{t.login.verifyBody}</Text>
        <Text style={[styles.verifyText, { color: colors.text, fontWeight: '600' }]}>{email.trim()}</Text>
        <Text style={[styles.verifyText, { color: colors.textSecondary }]}>{t.login.verifySpamHint}</Text>
        {resendNote && (
          <Text style={[styles.verifyText, { color: colors.text }]} accessibilityLiveRegion="polite">{resendNote}</Text>
        )}
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.accentFill }, busy && styles.btnDisabled]}
          onPress={handleResend}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t.login.verifyResend}
          accessibilityState={{ disabled: busy, busy }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t.login.verifyResend}</Text>}
        </Pressable>
        <Pressable
          style={styles.toggleBtn}
          onPress={() => { setPendingVerify(false); setRegisterMode(false); setResendNote(null); }}
          accessibilityRole="button"
        >
          <Text style={[styles.toggleBtnText, { color: colors.accent }]}>{t.login.verifyBack}</Text>
        </Pressable>
      </>
    );
  }

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
  verifyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  verifyText: { fontSize: 15, marginBottom: 8, textAlign: 'center' },
  input: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, marginBottom: 10 },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 6, minHeight: 44, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleBtn: { width: '100%', alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  toggleBtnText: { fontSize: 15, fontWeight: '500' },
});
