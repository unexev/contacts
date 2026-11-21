import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { downloadBackup, findBackup, uploadBackup } from '../../utils/driveSync';
import { syncNow as syncNowApi } from '../../utils/apiSync';
import {
  exportDatabaseToFile,
  importDatabaseFromFile,
  isTauri,
} from '../../utils/db';
import { useAuth } from '../../utils/authContext';
import { useContacts } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../utils/theme';
import { useRouter } from 'expo-router';
import { requestApi } from '../../utils/apiClient';
import {
  exportedContactCount, exportFileName, importCounts, InvalidExportFile, mapDataFailure, parseExportFile,
} from '../../utils/dataExport';

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
  const [loadingOp, setLoadingOp] = useState<string | null>(null);
  const [hasBackup, setHasBackup] = useState<boolean | null>(null);
  const { user, apiSession, driveToken, refreshDriveToken, signIn } = useAuth();
  const [dataStatus, setDataStatus] = useState<{ text: string; error: boolean } | null>(null);
  const { fetchContacts, importVcf } = useContacts();
  const { t } = useI18n();
  const { isDesktop } = useResponsive();
  const { colors } = useTheme();
  const router = useRouter();
  const isDesktopApp = isTauri();

  useEffect(() => {
    if (!driveToken) { setHasBackup(null); return; }
    let cancelled = false;
    findBackup(driveToken).then(backup => {
      if (!cancelled) setHasBackup(!!backup);
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

  const handleServerExport = async () => {
    try {
      setLoadingOp('serverExport');
      setDataStatus(null);
      const res = await requestApi('/api/export', {}, { raw: true });
      if (res.status < 200 || res.status >= 300 || !res.data) {
        setDataStatus({ text: t.accountData[mapDataFailure(res.status)], error: true });
        return;
      }
      const json = JSON.stringify(res.data, null, 2);
      if (isWeb) {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = exportFileName();
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const dir = FileSystem.cacheDirectory ?? '';
        const path = `${dir}${dir.endsWith('/') ? '' : '/'}${exportFileName()}`;
        await FileSystem.writeAsStringAsync(path, json);
        if (!(await Sharing.isAvailableAsync())) {
          setDataStatus({ text: t.config.sharingUnavailable, error: true });
          return;
        }
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: t.accountData.exportBtn, UTI: 'public.json' });
      }
      setDataStatus({ text: t.accountData.exportDone(exportedContactCount(res.data)), error: false });
    } catch (e) {
      console.error(e);
      setDataStatus({ text: t.accountData.failed, error: true });
    } finally {
      setLoadingOp(null);
    }
  };

  /** Merges an export document into the account on the server and refreshes this device. */
  const restoreFromText = async (text: string): Promise<{ text: string; error: boolean }> => {
    try {
      const doc = parseExportFile(text);
      const res = await requestApi('/api/import', { method: 'POST', body: JSON.stringify(doc) });
      if (res.status < 200 || res.status >= 300) {
        return { text: t.accountData[mapDataFailure(res.status)], error: true };
      }
      // The server merged the file; pull it so this device shows the same contacts.
      await syncNowApi();
      await fetchContacts();
      const { created, updated, skipped } = importCounts(res.data);
      return { text: t.accountData.importDone(created, updated, skipped), error: false };
    } catch (e) {
      return { text: e instanceof InvalidExportFile ? t.accountData.invalid : t.accountData.failed, error: true };
    }
  };

  const handleServerImport = async () => {
    try {
      setLoadingOp('serverImport');
      setDataStatus(null);
      const asset = await pickDocument();
      if (!asset) return;
      const text = isWeb
        ? await (asset.file ? asset.file.text() : (await fetch(asset.uri)).text())
        : await FileSystem.readAsStringAsync(asset.uri);
      setDataStatus(await restoreFromText(text));
    } catch {
      setDataStatus({ text: t.accountData.failed, error: true });
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

  /** Runs a Drive call with a valid token, renewing it once. False when the user must sign in again. */
  const runDrive = async (fn: (token: string) => Promise<void>): Promise<boolean> => {
    const token = driveToken ?? (await refreshDriveToken());
    if (!token) { promptSignIn(); return false; }
    try {
      await fn(token);
    } catch (e: any) {
      if (e.message !== 'TOKEN_EXPIRED') throw e;
      const fresh = await refreshDriveToken();
      if (!fresh) { promptSignIn(); return false; }
      await fn(fresh);
    }
    return true;
  };

  const handleDriveUpload = async () => {
    try {
      setLoadingOp('upload');
      setDriveStatus(null);
      const res = await requestApi('/api/export', {}, { raw: true });
      if (res.status < 200 || res.status >= 300 || !res.data) {
        setDriveStatus(t.drive.errorPrefix + t.accountData[mapDataFailure(res.status)]);
        return;
      }
      const json = JSON.stringify(res.data);
      if (await runDrive((token) => uploadBackup(token, json))) {
        setDriveStatus(t.drive.uploadSuccess);
        setHasBackup(true);
      }
    } catch (e: any) {
      setDriveStatus(t.drive.errorPrefix + (e?.message ?? String(e)));
    } finally {
      setLoadingOp(null);
    }
  };

  const handleDriveRestore = async () => {
    try {
      setLoadingOp('restore');
      setDriveStatus(null);
      let text = '';
      if (!(await runDrive(async (token) => { text = await downloadBackup(token); }))) return;
      const result = await restoreFromText(text);
      setDriveStatus(result.error ? t.drive.errorPrefix + result.text : result.text);
    } catch (e: any) {
      if (e?.message === 'NO_BACKUP') {
        setDriveStatus(t.drive.notFound);
        setHasBackup(false);
      } else {
        setDriveStatus(t.drive.errorPrefix + (e?.message ?? String(e)));
      }
    } finally {
      setLoadingOp(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
      {/* Base de datos */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t.config.database}</Text>
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
          style={[styles.button, styles.buttonExport, { backgroundColor: colors.accentFill }, !!loadingOp && styles.buttonDisabled]}
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

      {/* Datos de la cuenta (servidor) */}
      {apiSession && !isDesktopApp && (
        <View style={[styles.card, { marginTop: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t.accountData.title}</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t.accountData.desc}</Text>

          <Pressable accessibilityRole="button" accessibilityLabel={t.accountData.exportBtn}
            style={[styles.button, { backgroundColor: colors.accentFill }, !!loadingOp && styles.buttonDisabled]}
            onPress={handleServerExport}
            disabled={!!loadingOp}
          >
            {loadingOp === 'serverExport'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t.accountData.exportBtn}</Text>}
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel={t.accountData.importBtn}
            style={[styles.button, { backgroundColor: colors.successSolid }, !!loadingOp && styles.buttonDisabled]}
            onPress={handleServerImport}
            disabled={!!loadingOp}
          >
            {loadingOp === 'serverImport'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t.accountData.importBtn}</Text>}
          </Pressable>

          {dataStatus && (
            <View style={[styles.statusBox, { backgroundColor: dataStatus.error ? colors.statusErrorBg : colors.statusSuccessBg }]}>
              <Text accessibilityLiveRegion="polite" accessibilityRole={dataStatus.error ? 'alert' : undefined} style={[styles.statusText, { color: colors.text }]}>{dataStatus.text}</Text>
            </View>
          )}
        </View>
      )}

      {/* Google Drive: the account's JSON export, available when connected with Google */}
      {user && apiSession && (
        <View style={[styles.card, { marginTop: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t.drive.title}</Text>
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
  cardTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
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
  statusBox: { marginTop: 8, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8 },
  statusBoxError: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: 14, color: '#333' },
});
