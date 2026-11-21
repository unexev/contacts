import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarColorFor } from '../../utils/avatarColor';
import { requestApi } from '../../utils/apiClient';
import { useI18n } from '../../utils/i18n';
import { contactInitials, mapPhotoFailure, photoUrlFrom, PHOTO_TYPES, validatePhotoFile } from '../../utils/photoApi';
import { useTheme } from '../../utils/theme';
import { useToast } from '../../utils/toast';

const SIZE = 96;

interface Props {
  contactId: string;
  firstName: string;
  surname: string;
  /** Photos live on the server only: without an account the avatar shows initials and does nothing. */
  enabled: boolean;
}

export default function ContactPhoto({ contactId, firstName, surname, enabled }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const showToast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The signed URL is not part of the sync data, so it is asked for when the contact opens.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    requestApi(`/api/contacts/${encodeURIComponent(contactId)}`).then((res) => {
      if (alive && res.status === 200) setUrl(photoUrlFrom(res.data));
    });
    return () => { alive = false; };
  }, [contactId, enabled]);

  const fail = useCallback((key: 'type' | 'size' | 'network' | 'syncFirst' | 'unavailable' | 'failed') => {
    Alert.alert(t.common.error, t.contactPhoto[key]);
  }, [t]);

  const pick = useCallback(async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: PHOTO_TYPES, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const invalid = validatePhotoFile(asset);
    if (invalid) return fail(invalid);

    const form = new FormData();
    if (Platform.OS === 'web' && asset.file) form.append('photo', asset.file);
    else form.append('photo', { uri: asset.uri, name: asset.name || 'photo', type: asset.mimeType } as any);

    setBusy(true);
    const res = await requestApi(`/api/contacts/${encodeURIComponent(contactId)}/photo`, { method: 'PUT', body: form });
    setBusy(false);
    if (res.status !== 200) return fail(mapPhotoFailure(res.status));
    setUrl(photoUrlFrom(res.data));
    setFailedUrl(null);
    showToast(t.contactPhoto.updated);
  }, [contactId, fail, showToast, t]);

  const remove = useCallback(async () => {
    setBusy(true);
    const res = await requestApi(`/api/contacts/${encodeURIComponent(contactId)}/photo`, { method: 'DELETE' });
    setBusy(false);
    if (res.status !== 200) return fail(mapPhotoFailure(res.status));
    setUrl(null);
    showToast(t.contactPhoto.removed);
  }, [contactId, fail, showToast, t]);

  const openMenu = () => {
    if (busy) return;
    const buttons = [
      { text: url ? t.contactPhoto.change : t.contactPhoto.add, onPress: pick },
      ...(url ? [{ text: t.contactPhoto.remove, style: 'destructive' as const, onPress: remove }] : []),
      { text: t.common.cancel, style: 'cancel' as const },
    ];
    Alert.alert(t.contactPhoto.label(`${firstName} ${surname}`.trim()), undefined, buttons);
  };

  const showPhoto = !!url && failedUrl !== url;
  const avatar = (
    <View style={[styles.circle, { backgroundColor: avatarColorFor(firstName, surname), opacity: busy ? 0.5 : 1 }]}>
      {showPhoto ? (
        <Image source={{ uri: url! }} style={styles.image} contentFit="cover" onError={() => setFailedUrl(url)} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={styles.initials}>{contactInitials(firstName, surname)}</Text>
      )}
    </View>
  );

  if (!enabled) return <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{avatar}</View>;
  return (
    <Pressable
      style={styles.wrap}
      onPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel={t.contactPhoto.label(`${firstName} ${surname}`.trim())}
      accessibilityHint={url ? t.contactPhoto.change : t.contactPhoto.add}
    >
      {avatar}
      <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]} pointerEvents="none">
        <Ionicons name="camera" size={16} color={colors.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: SIZE, height: SIZE },
  initials: { color: '#fff', fontSize: 34, fontWeight: '600' },
});
