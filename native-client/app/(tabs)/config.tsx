import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../utils/authContext';
import { requestApi } from '../../utils/apiClient';
import { mapDeleteFailure } from '../../utils/authApi';
import { useResponsive } from '../../utils/responsive';
import { ThemePref, useTheme } from '../../utils/theme';
import { Lang, useI18n } from '../../utils/i18n';
import { isRCAvailable, rcGetOffering, rcPurchase, rcRestore, type RCOffering } from '../../utils/purchases';

const LANGUAGES: { code: Lang; transKey: 'langSpanish' | 'langEnglish'; flag: string }[] = [
  { code: 'es', transKey: 'langSpanish', flag: '🇪🇸' },
  { code: 'en', transKey: 'langEnglish', flag: '🇬🇧' },
];

const THEME_OPTIONS: { pref: ThemePref; key: 'themeLight' | 'themeSystem' | 'themeDark' }[] = [
  { pref: 'light', key: 'themeLight' },
  { pref: 'system', key: 'themeSystem' },
  { pref: 'dark', key: 'themeDark' },
];

export default function Config() {
  const { t, lang, setLang } = useI18n();
  const { user, isGuest, apiSession, licensed, signIn, signOutUser } = useAuth();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { colors, preference, setPreference } = useTheme();
  const handleSignOut = () => {
    if (!apiSession) {
      void signOutUser();
      return;
    }
    Alert.alert(t.config.signOutConfirmTitle, t.config.signOutConfirmMessage, [
      { text: t.config.cancel, style: 'cancel' },
      { text: t.config.signOut, style: 'destructive', onPress: () => void signOutUser() },
    ]);
  };
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const cancelDelete = () => {
    setDeleting(false);
    setDeletePassword('');
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (deleteBusy) return;
    if (!deletePassword) {
      setDeleteError(t.config.deletePasswordRequired);
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await requestApi('/api/auth/me', {
        method: 'DELETE',
        body: JSON.stringify({ current_password: deletePassword }),
      });
      if (res.status >= 200 && res.status < 300) {
        // The server data is gone; signing out also wipes this device's copy and the tokens.
        await signOutUser();
        return;
      }
      const reason = mapDeleteFailure(res.status);
      setDeleteError(
        reason === 'wrongPassword' ? t.config.deleteWrongPassword
          : reason === 'wait' ? t.config.deleteWait
          : reason === 'network' ? t.config.deleteNetwork
          : t.config.deleteFailed
      );
    } catch {
      setDeleteError(t.config.deleteFailed);
    } finally {
      setDeleteBusy(false);
    }
  };

  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [offering, setOffering] = useState<RCOffering | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (isRCAvailable && !licensed) {
      rcGetOffering().then(setOffering).catch(() => {});
    }
  }, [licensed]);

  const handlePurchase = async () => {
    if (!offering) return;
    try {
      setPurchasing(true);
      const ok = await rcPurchase(offering);
      if (!ok) Alert.alert('', t.config.purchaseError);
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert(t.common.error, e?.message ?? t.config.unknownError);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleGuestSignIn = async () => {
    setSignInError(null);
    setSignInBusy(true);
    try {
      await signIn();
    } catch (e: any) {
      setSignInError(e.message);
    } finally {
      setSignInBusy(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const ok = await rcRestore();
      Alert.alert(ok ? t.config.licenseRestored : t.config.noPreviousPurchases);
    } catch (e: any) {
      Alert.alert(t.common.error, e?.message ?? t.config.unknownError);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
      {/* Idioma */}
      <View style={[styles.card, { marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t.config.language}</Text>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t.config.languageDesc}</Text>
        <View style={styles.langRow}>
          {LANGUAGES.map(l => (
            <Pressable accessibilityRole="button"
              key={l.code}
              style={[styles.langBtn, { backgroundColor: colors.fill, borderColor: colors.separator }, lang === l.code && [styles.langBtnActive, { borderColor: colors.accent }, { backgroundColor: colors.accentSubtle }]]}
              onPress={() => setLang(l.code)}
            >
              <Text style={styles.langFlag}>{l.flag}</Text>
              <Text style={[styles.langLabel, { color: colors.text }, lang === l.code && [styles.langLabelActive, { color: colors.accent }]]}>{t.config[l.transKey]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Cuenta — invitado */}
      {!user && (
        <View style={[styles.card, { marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
            {t.config.account}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            {t.config.accountGuestDesc}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.config.signInWithGoogle}
            style={[styles.button, styles.buttonUpgrade, { backgroundColor: colors.accentFill }, signInBusy && styles.buttonDisabled]}
            onPress={handleGuestSignIn}
            disabled={signInBusy}
          >
            {signInBusy
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t.config.signInWithGoogle}</Text>}
          </Pressable>
          {signInError && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.error, { color: colors.destructiveText }]}>{signInError}</Text>}
        </View>
      )}

      {/* Cuenta */}
      {(user || apiSession) && (
        <View style={[styles.card, { marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t.config.account}</Text>
          <View style={styles.accountRow}>
            {user && <Text style={[styles.accountEmail, { color: colors.text }]}>{user.email}</Text>}
            <Text style={[styles.accountLicense, { color: colors.textSecondary }]}>
              {licensed ? t.config.activeLicense : t.config.freePlan}
            </Text>
          </View>
          {apiSession && (
            <Pressable accessibilityRole="button" style={[styles.button, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]} onPress={() => router.push('/account')}>
              <Text style={[styles.buttonText, { color: colors.text }]}>{t.accountPage.edit}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" style={[styles.button, styles.buttonSignOut, { backgroundColor: colors.destructiveFill }]} onPress={handleSignOut}>
            <Text style={styles.buttonText}>{t.config.signOut}</Text>
          </Pressable>
          {apiSession && (
            <View style={[styles.deleteSection, { borderTopColor: colors.separator }]}>
              <Text style={[styles.deleteTitle, { color: colors.destructiveText }]}>{t.config.deleteTitle}</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t.config.deleteWarning}</Text>
              {!deleting ? (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.deleteBtn, { borderColor: colors.destructive }]}
                  onPress={() => setDeleting(true)}
                >
                  <Text style={[styles.deleteBtnText, { color: colors.destructiveText }]}>{t.config.deleteAction}</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={[styles.cardDesc, { color: colors.text }]}>{t.config.deletePrompt}</Text>
                  <TextInput
                    style={[styles.deleteInput, { color: colors.text, borderColor: colors.textSecondary, backgroundColor: colors.bg }]}
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    placeholder={t.config.deletePasswordLabel}
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel={t.config.deletePasswordLabel}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    secureTextEntry
                    editable={!deleteBusy}
                    onSubmitEditing={handleDeleteAccount}
                  />
                  {deleteError && (
                    <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.error, { color: colors.destructiveText }]}>{deleteError}</Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: deleteBusy, busy: deleteBusy }}
                    style={[styles.button, { backgroundColor: colors.destructiveFill }, deleteBusy && styles.buttonDisabled]}
                    onPress={handleDeleteAccount}
                    disabled={deleteBusy}
                  >
                    {deleteBusy
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.buttonText}>{t.config.deleteConfirm}</Text>}
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.deleteCancel} onPress={cancelDelete} disabled={deleteBusy}>
                    <Text style={[styles.deleteBtnText, { color: colors.accent }]}>{t.config.cancel}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* Upgrade — solo Android, solo si no tiene licencia */}
      {user && !licensed && isRCAvailable && (
        <View style={[styles.card, { marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
            {t.config.removeAds}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            {t.config.removeAdsDesc}
          </Text>

          <Pressable accessibilityRole="button" accessibilityLabel={offering ? `${t.config.buy} — ${offering.product.priceString}` : t.config.loading}
            style={[styles.button, styles.buttonUpgrade, { backgroundColor: colors.accentFill }, (purchasing || !offering) && styles.buttonDisabled]}
            onPress={handlePurchase}
            disabled={purchasing || !offering}
          >
            {purchasing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>
                  {offering
                    ? `${t.config.buy} — ${offering.product.priceString}`
                    : t.config.loading}
                </Text>}
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel={t.config.restorePurchase}
            style={[styles.buttonRestore, restoring && styles.buttonDisabled]}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring
              ? <ActivityIndicator color="#007AFF" size="small" />
              : <Text style={[styles.buttonRestoreText, { color: colors.accent }]}>
                  {t.config.restorePurchase}
                </Text>}
          </Pressable>
        </View>
      )}

      {/* Modo oscuro */}
      {(
        <View style={[styles.card, { marginBottom: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
            {t.config.darkMode}
          </Text>
          {(
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map(opt => (
                <Pressable accessibilityRole="button"
                  key={opt.pref}
                  style={[styles.themeBtn, { borderColor: colors.separator, backgroundColor: colors.fill },
                    preference === opt.pref && { borderColor: colors.accent, backgroundColor: colors.accentSubtle }]}
                  onPress={() => setPreference(opt.pref)}
                >
                  <Text style={[styles.themeBtnText, { color: colors.textSecondary },
                    preference === opt.pref && { color: colors.accent, fontWeight: '700' }]}>
                    {t.config[opt.key]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  deleteSection: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  deleteTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  deleteBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  deleteBtnText: { fontSize: 15, fontWeight: '600' },
  deleteInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, marginVertical: 8 },
  deleteCancel: { alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  contentDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: '#6C6C70',
    marginBottom: 16,
    lineHeight: 20,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C7C7CC',
    backgroundColor: '#F9F9F9',
  },
  langBtnActive: {
    borderColor: '#0066D6',
    backgroundColor: '#E5F0FF',
  },
  langFlag: { fontSize: 20 },
  langLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  langLabelActive: { color: '#0066D6', fontWeight: '700' },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonSignOut: { backgroundColor: '#FF3B30' },
  accountRow: { marginBottom: 16 },
  accountEmail: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 4 },
  accountLicense: { fontSize: 13, color: '#6C6C70' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  buttonUpgrade: { backgroundColor: '#0066D6' },
  buttonRestore: { alignItems: 'center', paddingVertical: 14, minHeight: 48, justifyContent: 'center' },
  buttonRestoreText: { fontSize: 14, color: '#0066D6' },
  themeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  themeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  themeBtnText: { fontSize: 14 },
  premiumHint: { fontSize: 13, color: '#6C6C70', lineHeight: 20, marginTop: 4 },
  error: { color: '#FF3B30', fontSize: 13, textAlign: 'center', marginTop: 8 },
});
