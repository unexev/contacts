import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Dropdown from '../Dropdown';
import { MaritalStatus, useContacts } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { ContactDetail, formatDate } from '../../utils/contactUtils';
import { useSharedStyles } from './contactStyles';
import { listLabel } from '../../utils/listLabels';
import { useTheme } from '../../utils/theme';
import { normalizeChildrenCount, normalizeRelationshipStatus, RELATIONSHIP_STATUSES, type RelationshipStatus } from '../../utils/syncMapping';

interface Props {
  visible: boolean;
  contact: ContactDetail | null;
  onClose: () => void;
  onSaved: (updated: ContactDetail) => void;
}

export default function EditContactModal({ visible, contact, onClose, onSaved }: Props) {
  const s = useSharedStyles();
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { getMaritalStatuses, updateContact, getContact } = useContacts();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [childrenCount, setChildrenCount] = useState('');
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatus[]>([]);

  useEffect(() => {
    if (visible && contact) {
      getMaritalStatuses().then(setMaritalStatuses);
      setFirstName(contact.first_name);
      setMiddleName(contact.middle_name ?? '');
      setSurname(contact.surname);
      setBirthdate(contact.birthdate ?? '');
      setGender((contact.gender as 'MALE' | 'FEMALE') ?? null);
      setStatusId(contact.status_id ?? null);
      setRelationshipStatus(normalizeRelationshipStatus(contact.relationship_status));
      setChildrenCount(contact.children_count == null ? '' : String(contact.children_count));
    }
  }, [visible, contact]);

  const handleSave = async () => {
    if (!firstName.trim() || !surname.trim()) {
      Alert.alert(t.common.error, t.contacts.nameRequired);
      return;
    }
    const children = normalizeChildrenCount(childrenCount);
    if (childrenCount.trim() && children === null) {
      Alert.alert(t.common.error, t.contacts.childrenInvalid);
      return;
    }
    const ok = await updateContact(contact!.contact_id, {
      first_name: firstName.trim(),
      middle_name: middleName.trim() || undefined,
      surname: surname.trim(),
      birthdate: birthdate.trim() || undefined,
      gender: gender ?? undefined,
      status_id: statusId ?? undefined,
      relationship_status: relationshipStatus,
      children_count: children,
    });
    if (ok) {
      const updated = await getContact(contact!.contact_id);
      if (updated) onSaved(updated as ContactDetail);
      onClose();
    } else {
      Alert.alert(t.common.error, t.editContact.saveError);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer} accessibilityViewIsModal={true}>
            <Text style={s.modalTitle}>{t.editContact.title}</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 12 }}
            >

              <Text style={s.fieldLabel}>{t.contacts.firstName} <Text style={s.required}>{t.common.required}</Text></Text>
              <TextInput accessibilityLabel={t.contacts.firstNamePlaceholder} style={s.input} value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.placeholder} placeholder={t.contacts.firstNamePlaceholder} />

              <Text style={s.fieldLabel}>{t.contacts.middleName}</Text>
              <TextInput accessibilityLabel={t.contacts.middleNamePlaceholder} style={s.input} value={middleName} onChangeText={setMiddleName} placeholderTextColor={colors.placeholder} placeholder={t.contacts.middleNamePlaceholder} />

              <Text style={s.fieldLabel}>{t.contacts.surname} <Text style={s.required}>{t.common.required}</Text></Text>
              <TextInput accessibilityLabel={t.contacts.surnamePlaceholder} style={s.input} value={surname} onChangeText={setSurname} placeholderTextColor={colors.placeholder} placeholder={t.contacts.surnamePlaceholder} />

              <Text style={s.fieldLabel}>{t.contacts.gender}</Text>
              <View style={styles.genderRow}>
                {(['MALE', 'FEMALE'] as const).map(g => (
                  <Pressable accessibilityRole="button"
                    key={g}
                    style={[styles.genderChip, gender === g && [styles.genderChipSelected, { borderColor: colors.accent }, { backgroundColor: colors.accent }]]}
                    onPress={() => setGender(prev => prev === g ? null : g)}
                  >
                    <Text style={[styles.genderChipText, gender === g && styles.genderChipTextSelected]}>
                      {g === 'MALE' ? t.contacts.male : t.contacts.female}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>{t.contacts.birthdate}</Text>
              <TextInput accessibilityLabel={t.contacts.birthdatePlaceholder}
                style={s.input} value={birthdate} onChangeText={v => formatDate(v, setBirthdate)}
                placeholder={t.contacts.birthdatePlaceholder} placeholderTextColor={colors.placeholder}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} maxLength={10}
              />

              <Text style={s.fieldLabel}>{t.contacts.maritalStatus}</Text>
              <Dropdown
                options={maritalStatuses.map(ms => ({ label: listLabel('marital', lang, ms.status_id, ms.marital_status), value: ms.status_id }))}
                value={statusId}
                onSelect={setStatusId}
                allowNull
              />

              <Text style={s.fieldLabel}>{t.contacts.relationshipStatus}</Text>
              <View style={styles.genderRow}>
                {RELATIONSHIP_STATUSES.map(rs => (
                  <Pressable accessibilityRole="button"
                    accessibilityState={{ selected: relationshipStatus === rs }}
                    key={rs}
                    style={[styles.genderChip, styles.relationshipChip, relationshipStatus === rs && [styles.genderChipSelected, { borderColor: colors.accent }, { backgroundColor: colors.accent }]]}
                    onPress={() => setRelationshipStatus(prev => prev === rs ? null : rs)}
                  >
                    <Text numberOfLines={2} style={[styles.genderChipText, styles.relationshipChipText, relationshipStatus === rs && styles.genderChipTextSelected]}>
                      {rs === 'SINGLE' ? t.contacts.relationshipSingle : rs === 'PARTNERED' ? t.contacts.relationshipPartnered : t.contacts.relationshipCohabiting}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>{t.contacts.children}</Text>
              <TextInput accessibilityLabel={t.contacts.children}
                style={s.input} value={childrenCount}
                onChangeText={v => setChildrenCount(v.replace(/\D/g, '').slice(0, 2))}
                placeholder={t.contacts.childrenPlaceholder} placeholderTextColor={colors.placeholder}
                keyboardType="number-pad" maxLength={2}
              />

            </ScrollView>

            <View style={[s.modalActions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable accessibilityRole="button" style={s.btnCancel} onPress={onClose}>
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
  );
}

const styles = StyleSheet.create({
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#C7C7CC', alignItems: 'center', backgroundColor: '#F9F9F9',
  },
  genderChipSelected: { backgroundColor: '#0066D6', borderColor: '#0066D6' },
  genderChipText: { fontSize: 15, color: '#333' },
  genderChipTextSelected: { color: '#fff', fontWeight: '600' },
  relationshipChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  relationshipChipText: { fontSize: 14, textAlign: 'center' },
});
