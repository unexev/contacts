import { useToast } from '../utils/toast';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { copyToClipboard } from '../utils/clipboard';
import { contactActions, type ContactActionKey } from '../utils/contactActions';
import { useI18n } from '../utils/i18n';
import { useTheme } from '../utils/theme';

const ICONS: Record<ContactActionKey, React.ComponentProps<typeof Ionicons>['name']> = {
  call: 'call-outline',
  whatsapp: 'logo-whatsapp',
  email: 'mail-outline',
  copy: 'copy-outline',
};

interface Props {
  visible: boolean;
  name: string;
  phone: string;
  email: string;
  /** False when the person no longer uses the phone: only Copy is offered. */
  canCall: boolean;
  onClose: () => void;
}

/** Quick actions for one contact's main phone and email, opened from a list row. */
export default function ContactActionsMenu({ visible, name, phone, email, canCall, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const showToast = useToast();
  const actions = contactActions(phone, email, canCall);
  const labels: Record<ContactActionKey, string> = {
    call: t.contactList.actionCall,
    whatsapp: t.contactList.actionWhatsApp,
    email: t.contactList.actionEmail,
    copy: t.contactList.actionCopyNumber,
  };

  const run = async (key: ContactActionKey, url?: string) => {
    onClose();
    try {
      if (key === 'copy') {
        await copyToClipboard(phone);
        showToast(t.contactList.actionCopied);
      } else if (url) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert(t.common.error, key === 'copy' ? t.contactList.actionCopyFailed : t.contactList.actionOpenFailed);
    }
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessible={false} style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
          accessibilityViewIsModal
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">{name}</Text>
            {!!phone && <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{phone}</Text>}
          </View>
          {actions.map((action, i) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              onPress={() => run(action.key, action.url)}
              style={({ pressed }) => [
                styles.item,
                i < actions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                pressed && { backgroundColor: colors.surface2 },
              ]}
            >
              <Ionicons name={ICONS[action.key]} size={20} color={colors.textSecondary} />
              <Text style={[styles.itemText, { color: colors.text }]}>{labels[action.key]}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '92%', maxWidth: 420, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12 },
  itemText: { flex: 1, fontSize: 15 },
});
