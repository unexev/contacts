import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Dropdown from '../Dropdown';
import { ContactNationality, useContacts } from '../../utils/context';
import { COUNTRY_CODES, countryName } from '../../utils/countries';
import { toDisplayDate } from '../../utils/dates';
import { formatDate } from '../../utils/contactUtils';
import { useI18n } from '../../utils/i18n';
import { validateNationality } from '../../utils/placeRecords';
import { useTheme } from '../../utils/theme';
import AddButtonLabel from './AddButtonLabel';
import { useSharedStyles } from './contactStyles';

interface Props {
  contactId: string;
  initialNationalities: ContactNationality[];
}

export default function NationalitiesCard({ contactId, initialNationalities }: Props) {
  const s = useSharedStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { getNationalities, addNationality, updateNationality, deleteNationality } = useContacts();

  const [items, setItems] = useState<ContactNationality[]>(initialNationalities);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [acquiredAt, setAcquiredAt] = useState('');
  const [note, setNote] = useState('');

  const openAddModal = () => {
    setEditingId(null);
    setCountryCode(null);
    setAcquiredAt('');
    setNote('');
    setModalVisible(true);
  };

  const openEditModal = (n: ContactNationality) => {
    setEditingId(n.id);
    setCountryCode(n.country_code);
    setAcquiredAt(toDisplayDate(n.acquired_at));
    setNote(n.note ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const result = validateNationality({ countryCode, acquiredAt, note });
    if (!result.ok) {
      Alert.alert(t.common.error, result.error === 'country' ? t.nationalities.countryRequired : t.nationalities.dateInvalid);
      return;
    }
    const ok = editingId !== null ? await updateNationality(editingId, result.value) : await addNationality(contactId, result.value);
    if (ok) {
      setItems(await getNationalities(contactId));
      setModalVisible(false);
    } else {
      Alert.alert(t.common.error, t.nationalities.saveError);
    }
  };

  const handleRemove = (n: ContactNationality) => {
    Alert.alert(t.nationalities.deleteTitle, t.nationalities.deleteConfirm(countryName(n.country_code, t.countries)), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete, style: 'destructive', onPress: async () => {
          await deleteNationality(n.id);
          setItems(prev => prev.filter(x => x.id !== n.id));
        },
      },
    ]);
  };

  return (
    <>
      {items.length === 0 ? (
        <Pressable accessibilityRole="button" style={s.addRow} onPress={openAddModal}>
          <View style={s.addRowIcon} accessible={false} importantForAccessibility="no-hide-descendants"><Ionicons name="add" size={18} color={colors.accent} /></View>
          <Text style={s.addRowLabel}>{t.nationalities.title}</Text>
        </Pressable>
      ) : (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{t.nationalities.title}</Text>
            <Pressable accessibilityRole="button" style={s.addButton} onPress={openAddModal} accessibilityLabel={t.nationalities.addTitle}>
              <AddButtonLabel />
            </Pressable>
          </View>
          {items.map(n => (
            <View key={n.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={[styles.country, { color: colors.text }]}>{countryName(n.country_code, t.countries)}</Text>
                {n.acquired_at ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{t.nationalities.acquiredLabel} {toDisplayDate(n.acquired_at)}</Text> : null}
                {n.note ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{n.note}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" onPress={() => openEditModal(n)} style={styles.editBtn} accessibilityLabel={t.common.edit}>
                <Text style={[styles.editBtnText, { color: colors.accent }]}>{t.common.edit}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => handleRemove(n)} style={s.removeBtn} accessibilityLabel={t.common.delete}>
                <Ionicons name="close" size={20} color={colors.destructiveText} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <View style={s.modalContainer} accessibilityViewIsModal={true}>
              <Text style={s.modalTitle}>{editingId !== null ? t.common.edit : t.nationalities.addTitle}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.fieldLabel}>{t.nationalities.country} <Text style={s.required}>{t.common.required}</Text></Text>
                <Dropdown
                  options={COUNTRY_CODES.map(code => ({ label: t.countries[code], value: code }))}
                  value={countryCode}
                  onSelect={setCountryCode}
                />

                <Text style={s.fieldLabel}>{t.nationalities.acquiredAt}</Text>
                <TextInput accessibilityLabel={t.nationalities.acquiredAt}
                  style={s.input} value={acquiredAt} onChangeText={v => formatDate(v, setAcquiredAt)}
                  placeholder={t.contacts.birthdatePlaceholder} placeholderTextColor={colors.placeholder}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} maxLength={10}
                />

                <Text style={s.fieldLabel}>{t.nationalities.note}</Text>
                <TextInput accessibilityLabel={t.nationalities.note}
                  style={s.input} value={note} onChangeText={setNote}
                  placeholder={t.nationalities.notePlaceholder} placeholderTextColor={colors.placeholder}
                />
              </ScrollView>

              <View style={s.modalActions}>
                <Pressable accessibilityRole="button" style={s.btnCancel} onPress={() => setModalVisible(false)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={s.btnSave} onPress={handleSave}>
                  <Text style={s.btnSaveText}>{t.common.save}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  info: { flex: 1 },
  country: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, marginTop: 2 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 14 },
});
