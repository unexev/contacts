import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { checkBackupExists, downloadDB, uploadDB } from '../../utils/driveSync';
import {
  exportDatabaseToFile,
  importDatabaseFromFile,
  isTauri,
  readDatabaseAsBase64,
  writeDatabaseFromBase64,
} from '../../utils/db';
import { useAuth } from '../../utils/authContext';
import { useContacts } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../utils/theme';
import { useRouter } from 'expo-router';

const isWeb = Platform.OS === 'web';
const DB_FILTERS = [{ name: 'SQLite', extensions: ['db', 'sqlite'] }];

function backupFileName(): string {
  return `contacts_backup_${Date.now()}.db`;
}

/** Desktop open dialog for a single file; null when cancelled. */
async function pickDesktopFile(filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ multiple: false, directory: false, filters });
  return typeof picked === 'string' ? picked : null;
}

/** Browser/Android document picker; returns the first asset or null when cancelled. */
async function pickDocument() {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  return picked.canceled ? null : picked.assets[0];
}

export default function SyncScreen() {
  const [status, setStatus] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [loadingOp, setLoadingOp] = useState<string | null>(null);
  const [hasBackup, setHasBackup] = useState<boolean | null>(null);
  const { user, driveToken, refreshDriveToken, signIn } = useAuth();
  const { fetchContacts, importVcf, syncing, syncEnabled, lastSyncAt, setSyncEnabled, syncNow } = useContacts();
  const { t, lang } = useI18n();
  const { isDesktop } = useResponsive();
  const { colors } = useTheme();
  const router = useRouter();
  const isDesktopApp = isTauri();

  useEffect(() => {
    if (!driveToken) { setHasBackup(null); return; }
    let cancelled = false;
    checkBackupExists(driveToken).then(exists => {
      if (!cancelled) setHasBackup(exists);
    }).catch(() => {
      if (!cancelled) setHasBackup(false);
    });
    return () => { cancelled = true; };
  }, [driveToken]);

  const handleExport = async () => {
    try {
      setLoadingOp('export');
      setStatus(null);

      if (isDesktopApp) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const path = await save({ defaultPath: backupFileName(), filters: DB_FILTERS });
        if (!path) return;
        await exportDatabaseToFile(path);
        setStatus(t.config.exportSuccess);
        return;
      }

      if (isWeb) {
        await exportDatabaseToFile(backupFileName());
        setStatus(t.config.exportSuccess);
        return;
      }

      const cacheDir = FileSystem.cacheDirectory ?? '';
      const exportPath = cacheDir.endsWith('/')
        ? `${cacheDir}contacts_backup_${Date.now()}.db`
        : `${cacheDir}/contacts_backup_${Date.now()}.db`;
      await exportDatabaseToFile(exportPath);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setStatus(t.config.sharingUnavailable);
        return;
      }

      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/octet-stream',
        dialogTitle: t.config.exportBtn,
        UTI: 'public.database',
      });

      setStatus(t.config.exportSuccess);
    } catch (e) {
      console.error(e);
      setStatus(t.config.exportErrorPrefix + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingOp(null);
    }
  };

  const handleImportVcf = async () => {
    try {
      setLoadingOp('vcf');
      setStatus(null);
      let content: string | null = null;

      if (isDesktopApp) {
        const path = await pickDesktopFile([{ name: 'vCard', extensions: ['vcf', 'vcard'] }]);
        if (!path) return;
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        content = await readTextFile(path);
      } else {
        const asset = await pickDocument();
        if (!asset) return;
        content = isWeb
          ? await (asset.file ? asset.file.text() : (await fetch(asset.uri)).text())
          : await FileSystem.readAsStringAsync(asset.uri);
      }

      if (!content) return;
      const { imported, skipped } = await importVcf(content);
      setStatus(t.sync.vcfResult(imported, skipped));
    } catch (e) {
      setStatus(t.sync.errorPrefix + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingOp(null);
    }
  };

  const handleImport = async () => {
    if (isWeb) {
      if (!confirm(t.config.importConfirm)) return;
      try {
        setLoadingOp('import');
        setStatus(null);
        let source: string | null;
        if (isDesktopApp) {
          source = await pickDesktopFile(DB_FILTERS);
        } else {
          const asset = await pickDocument();
          source = asset?.uri ?? null;
        }
        if (!source) return;
        await importDatabaseFromFile(source);
        await fetchContacts();
        setStatus(t.config.importSuccess);
      } catch (e) {
        setStatus(t.config.importErrorPrefix + (e instanceof Error ? e.message : String(e)));
      } finally {
        setLoadingOp(null);
      }
      return;
    }

    Alert.alert(
      t.config.importTitle,
      t.config.importConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.config.importContinue, style: 'destructive', onPress: async () => {
            try {
              setLoadingOp('import');
              setStatus(null);

              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });

              if (result.canceled) {
                setLoadingOp(null);
                return;
              }

              const file = result.assets[0];

              await importDatabaseFromFile(file.uri);
              await fetchContacts();

              setStatus(t.config.importSuccess);
              Alert.alert(t.config.importSuccessTitle, t.config.importSuccessMsg);
            } catch (e) {
              console.error(e);
              setStatus(t.config.importErrorPrefix + (e instanceof Error ? e.message : String(e)));
            } finally {
              setLoadingOp(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleSync = async (value: boolean) => {
    if (value && !driveToken) { promptSignIn(); return; }
    await setSyncEnabled(value);
  };

  const handleSyncNow = async () => {
    if (!driveToken) { promptSignIn(); return; }
    setSyncStatus(null);
    const res = await syncNow();
    if (res.error) setSyncStatus(t.sync.errorPrefix + res.error);
    else setSyncStatus(res.changed ? t.sync.imported : t.sync.upToDate);
  };

  const lastSyncLabel = lastSyncAt
    ? `${t.sync.lastSync}: ${new Date(lastSyncAt).toLocaleString(lang === 'es' ? 'es' : 'en')}`
    : t.sync.never;

  const promptSignIn = () => {
    const title = driveToken === null && !user ? t.drive.notLoggedInTitle : t.drive.sessionExpiredTitle;
    const msg   = driveToken === null && !user ? t.drive.notLoggedInMsg   : t.drive.sessionExpiredMsg;

    const doSignIn = async () => {
      try {
        await signIn();
      } catch (e: any) {
        if (e.message === 'USE_EXPO_AUTH') {
          router.push('/login' as any);
        } else {
          setStatus(t.drive.errorPrefix + e.message);
        }
      }
    };

    if (isWeb) {
      if (confirm(msg)) doSignIn();
    } else {
      Alert.alert(title, msg, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.drive.signInBtn, onPress: doSignIn },
      ]);
    }
  };

  const handleDriveUpload = async () => {
    let token = driveToken;
    if (!token) {
      token = await refreshDriveToken();
      if (!token) { promptSignIn(); return; }
    }
    try {
      setLoadingOp('upload');
      setDriveStatus(null);
      const base64 = await readDatabaseAsBase64();
      await uploadDB(token, base64);
      setDriveStatus(t.drive.uploadSuccess);
      setHasBackup(true);
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') {
        const newToken = await refreshDriveToken();
        if (newToken) {
          try {
            const base64 = await readDatabaseAsBase64();
            await uploadDB(newToken, base64);
            setDriveStatus(t.drive.uploadSuccess);
            setHasBackup(true);
          } catch {
            promptSignIn();
          }
        } else {
          promptSignIn();
        }
      } else {
        setDriveStatus(t.drive.errorPrefix + e.message);
      }
    } finally {
      setLoadingOp(null);
    }
  };

  const handleDriveRestore = async () => {
    if (!driveToken) { promptSignIn(); return; }

    const doRestore = async () => {
      let token = driveToken ?? await refreshDriveToken();
      if (!token) { promptSignIn(); return; }
      try {
        setLoadingOp('restore');
        setDriveStatus(null);
        const base64 = await downloadDB(token);
        await writeDatabaseFromBase64(base64);
        await fetchContacts();
        setDriveStatus(t.drive.restoreSuccess);
      } catch (e: any) {
        if (e.message === 'NO_BACKUP') {
          setDriveStatus(t.drive.notFound);
          setHasBackup(false);
        } else if (e.message === 'TOKEN_EXPIRED') {
          const newToken = await refreshDriveToken();
          if (newToken) doRestore();
          else promptSignIn();
        } else {
          setDriveStatus(t.drive.errorPrefix + e.message);
        }
      } finally {
        setLoadingOp(null);
      }
    };

    if (isWeb) {
      if (confirm(t.config.importConfirm)) doRestore();
    } else {
      Alert.alert(t.config.importTitle, t.config.importConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.config.importContinue, style: 'destructive', onPress: doRestore },
      ]);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
      {/* Base de datos */}
      <View style={[styles.card, { backgroundColor: colors.surface, shadowOpacity: colors.shadowOpacity }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t.config.database}</Text>
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t.config.databaseDesc}</Text>

        <Pressable accessibilityRole="button" accessibilityLabel={t.config.importVcfBtn}
          style={[styles.button, styles.buttonVcf, !!loadingOp && styles.buttonDisabled]}
          onPress={handleImportVcf}
          disabled={!!loadingOp}
        >
          {loadingOp === 'vcf'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t.config.importVcfBtn}</Text>}
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel={t.config.exportBtn}
          style={[styles.button, styles.buttonExport, { backgroundColor: colors.accent }, !!loadingOp && styles.buttonDisabled]}
          onPress={handleExport}
          disabled={!!loadingOp}
        >
          {loadingOp === 'export'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t.config.exportBtn}</Text>}
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel={t.config.importBtn}
          style={[styles.button, styles.buttonImport, { backgroundColor: colors.successSolid }, !!loadingOp && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={!!loadingOp}
        >
          {loadingOp === 'import'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t.config.importBtn}</Text>}
        </Pressable>

        {status && (
          <View style={[styles.statusBox, { backgroundColor: colors.statusSuccessBg }, { backgroundColor: status.startsWith('Error') ? colors.statusErrorBg : colors.statusSuccessBg }]}>
            <Text accessibilityLiveRegion="polite" accessibilityRole={status.startsWith('Error') ? 'alert' : undefined} style={[styles.statusText, { color: colors.text }]}>{status}</Text>
          </View>
        )}
      </View>

      {/* Google Drive */}
      {user && (
        <View style={[styles.card, { marginTop: 16, backgroundColor: colors.surface, shadowOpacity: colors.shadowOpacity }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t.drive.title}</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t.drive.desc}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.drive.upload}
            style={[styles.button, styles.buttonDrive, !!loadingOp && styles.buttonDisabled]}
            onPress={handleDriveUpload}
            disabled={!!loadingOp}
          >
            {loadingOp === 'upload'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t.drive.upload}</Text>}
          </Pressable>
          {hasBackup === false && (
            <View style={[styles.statusBox, { backgroundColor: colors.statusSuccessBg }, { backgroundColor: colors.statusErrorBg, marginBottom: 10 }]}>
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.statusText, { color: colors.text }]}>{t.drive.notFound}</Text>
            </View>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={t.drive.restore}
            style={[styles.button, styles.buttonDriveRestore, (!!loadingOp || hasBackup === false) && styles.buttonDisabled]}
            onPress={handleDriveRestore}
            disabled={!!loadingOp || hasBackup === false}
          >
            {loadingOp === 'restore'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t.drive.restore}</Text>}
          </Pressable>
          {driveStatus && (
            <View style={[styles.statusBox, { backgroundColor: colors.statusSuccessBg }, { backgroundColor: driveStatus.startsWith('Error') ? colors.statusErrorBg : colors.statusSuccessBg }]}>
              <Text accessibilityLiveRegion="polite" accessibilityRole={driveStatus.startsWith('Error') ? 'alert' : undefined} style={[styles.statusText, { color: colors.text }]}>{driveStatus}</Text>
            </View>
          )}
        </View>
      )}

      {/* Sincronización entre dispositivos */}
      {user && (
        <View style={[styles.card, { marginTop: 16, backgroundColor: colors.surface, shadowOpacity: colors.shadowOpacity }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t.sync.title}</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t.sync.desc}</Text>
          <View style={styles.syncRow}>
            <Text style={[styles.syncLabel, { color: colors.text }]}>{t.sync.autoLabel}</Text>
            <Switch
              value={syncEnabled}
              onValueChange={handleToggleSync}
              disabled={!driveToken || syncing}
            />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t.sync.syncNow}
            style={[styles.button, styles.buttonSync, (syncing || !driveToken) && styles.buttonDisabled]}
            onPress={handleSyncNow}
            disabled={syncing || !driveToken}
          >
            {syncing
              ? <ActivityIndicator color="#1A73E8" />
              : <Text style={styles.buttonTextSync}>{t.sync.syncNow}</Text>}
          </Pressable>
          <Text style={[styles.syncHint, { color: colors.textSecondary }]}>{lastSyncLabel}</Text>
          {syncStatus && (
            <View style={[styles.statusBox, { backgroundColor: colors.statusSuccessBg }, { backgroundColor: syncStatus.startsWith('Error') ? colors.statusErrorBg : colors.statusSuccessBg }]}>
              <Text accessibilityLiveRegion="polite" accessibilityRole={syncStatus.startsWith('Error') ? 'alert' : undefined} style={[styles.statusText, { color: colors.text }]}>{syncStatus}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20, paddingBottom: 40, maxWidth: 800, width: '100%', alignSelf: 'center' },
  contentDesktop: { paddingHorizontal: 32, paddingVertical: 28 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#6C6C70', marginBottom: 16, lineHeight: 20 },
  button: {
    paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10,
  },
  buttonVcf: { backgroundColor: '#5856D6' },
  buttonExport: { backgroundColor: '#0066D6' },
  buttonImport: { backgroundColor: '#1F7A36' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  buttonDrive: { backgroundColor: '#1a73e8' },
  buttonDriveRestore: { backgroundColor: '#34A853' },
  buttonSync: { backgroundColor: '#F0F4FF', borderWidth: 1, borderColor: '#1A73E8' },
  buttonTextSync: { fontSize: 16, fontWeight: '600', color: '#1A73E8' },
  syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  syncLabel: { fontSize: 15, fontWeight: '500' },
  syncHint: { fontSize: 12, color: '#6C6C70', marginTop: 4, marginBottom: 4 },
  statusBox: { marginTop: 8, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8 },
  statusBoxError: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: 14, color: '#333' },
});
