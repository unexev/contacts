import { Ionicons } from '@expo/vector-icons';
// Android: usa @react-native-google-signin/google-signin (SDK nativo, no requiere redirect URI)
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { auth } from '../utils/firebase';
import { useAuth } from '../utils/authContext';
import { useTheme } from '../utils/theme';
import { useI18n } from '../utils/i18n';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

GoogleSignin.configure({
  ...(WEB_CLIENT_ID ? { webClientId: WEB_CLIENT_ID, offlineAccess: true } : {}),
  scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
});

export default function LoginScreen() {
  const { t } = useI18n();
  const { isAuthenticated, loading, continueAsGuest, setDriveToken, loginWithPassword, registerWithPassword } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [registerMode, setRegisterMode] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [emailBusy, setEmailBusy] = React.useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/');
  }, [isAuthenticated, loading]);

  const handleEmailSubmit = async () => {
    if (emailBusy) return;
    setError(null);
    setEmailBusy(true);
    try {
      const result = registerMode
        ? await registerWithPassword(email, name, password)
        : await loginWithPassword(email, password);
      if (!result.ok) setError(t.login[result.errorKey]);
    } finally {
      setEmailBusy(false);
    }
  };

  const toggleMode = () => {
    setError(null);
    setRegisterMode((m) => !m);
  };

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) throw new Error('Google token not received.');
      const tokens = await GoogleSignin.getTokens();
      const credential = GoogleAuthProvider.credential(idToken, tokens.accessToken);
      await signInWithCredential(auth, credential);
      setDriveToken(tokens.accessToken);
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // usuario canceló, no mostrar error
      } else if (e.code === statusCodes.IN_PROGRESS) {
        // ya hay un sign-in en curso
      } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError(t.login.playServicesError);
      } else {
        setError(e.message ?? t.login.signInError);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    await continueAsGuest();
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.accent }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: colors.surface, shadowOpacity: colors.shadowOpacityMedium }]}>
        <View style={[styles.iconPlaceholder, { backgroundColor: colors.accentSubtle }]}>
          <Ionicons name="people" size={44} color="#0066D6" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t.login.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t.login.subtitle}</Text>
        {registerMode && (
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.textSecondary, backgroundColor: colors.bg }]}
            value={name}
            onChangeText={setName}
            placeholder={t.login.nameLabel}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t.login.nameLabel}
            autoCapitalize="words"
            autoComplete="name"
            editable={!emailBusy}
          />
        )}
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.textSecondary, backgroundColor: colors.bg }]}
          value={email}
          onChangeText={setEmail}
          placeholder={t.login.emailLabel}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t.login.emailLabel}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          editable={!emailBusy}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.textSecondary, backgroundColor: colors.bg }]}
          value={password}
          onChangeText={setPassword}
          placeholder={t.login.passwordLabel}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t.login.passwordLabel}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={registerMode ? 'new-password' : 'current-password'}
          secureTextEntry
          editable={!emailBusy}
          onSubmitEditing={handleEmailSubmit}
          returnKeyType="go"
        />
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.accentFill }, emailBusy && styles.btnDisabled]}
          onPress={handleEmailSubmit}
          disabled={emailBusy}
          accessibilityRole="button"
          accessibilityLabel={registerMode ? t.login.createAccount : t.login.signInWithEmail}
          accessibilityState={{ disabled: emailBusy, busy: emailBusy }}
        >
          {emailBusy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>{registerMode ? t.login.createAccount : t.login.signInWithEmail}</Text>}
        </Pressable>
        <Pressable style={styles.toggleBtn} onPress={toggleMode} disabled={emailBusy} accessibilityRole="button">
          <Text style={[styles.guestBtnText, { color: colors.accent }]}>
            {registerMode ? t.login.switchToSignIn : t.login.switchToRegister}
          </Text>
        </Pressable>
        <Text style={[styles.googleHint, { color: colors.textSecondary }]}>{t.login.orDivider}</Text>
        <Pressable
          style={[styles.secondaryBtn, { backgroundColor: colors.fill, borderColor: colors.separator }, busy && styles.btnDisabled]}
          onPress={handleSignIn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t.login.continueWithGoogle}
          accessibilityState={{ disabled: busy, busy }}
        >
          {busy
            ? <ActivityIndicator color={colors.text} />
            : <Text style={[styles.secondaryBtnText, { color: colors.text }]}>{t.login.continueWithGoogle}</Text>}
        </Pressable>
        <Text style={[styles.googleHint, { color: colors.textSecondary }]}>{t.login.enableBackup}</Text>
        <Pressable style={styles.guestBtn} onPress={handleGuest}>
          <Text style={[styles.guestBtnText, { color: colors.accent }]}>{t.login.continueAsGuest}</Text>
        </Pressable>
        {error && <Text style={[styles.error, { color: colors.destructiveText }]}>{error}</Text>}
        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>{t.login.disclaimer}</Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  input: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, marginBottom: 10 },
  toggleBtn: { width: '100%', alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 32,
    width: '100%', maxWidth: 380, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  iconPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#E5F0FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#000', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6C6C70', textAlign: 'center', marginBottom: 20 },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 6 },
  secondaryBtn: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 6 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  googleHint: { fontSize: 12, color: '#6C6C70', textAlign: 'center', marginBottom: 16 },
  guestBtn: { width: '100%', alignItems: 'center', paddingVertical: 16, marginBottom: 8, minHeight: 48, justifyContent: 'center' },
  guestBtnText: { color: '#0066D6', fontSize: 15, fontWeight: '500' },
  error: { color: '#FF3B30', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  disclaimer: { fontSize: 12, color: '#6C6C70', textAlign: 'center', marginTop: 8 },
});
