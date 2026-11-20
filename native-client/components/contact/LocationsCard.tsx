import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Dropdown from '../Dropdown';
import { ContactLocation, useContacts } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { LOCATION_TYPES, locationSummary, validateLocation } from '../../utils/placeRecords';
import { useTheme } from '../../utils/theme';
import AddButtonLabel from './AddButtonLabel';
import { useSharedStyles } from './contactStyles';

interface Props {
  contactId: string;
  initialLocations: ContactLocation[];
}

const EMPTY = { type: '', address: '', city: '', region: '', country: '', postalCode: '', latitude: '', longitude: '' };

export default function LocationsCard({ contactId, initialLocations }: Props) {
  const s = useSharedStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { getLocations, addLocation, updateLocation, deleteLocation } = useContacts();

  const [locations, setLocations] = useState<ContactLocation[]>(initialLocations);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const typeLabel = (type: string) => (LOCATION_TYPES as readonly string[]).includes(type) ? t.locations[type as typeof LOCATION_TYPES[number]] : '';

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY);
    setModalVisible(true);
  };

  const openEditModal = (l: ContactLocation) => {
    setEditingId(l.id);
    setForm({
      type: l.location_type, address: l.address ?? '', city: l.city ?? '', region: l.region ?? '',
      country: l.country ?? '', postalCode: l.postal_code ?? '',
      latitude: l.latitude == null ? '' : String(l.latitude), longitude: l.longitude == null ? '' : String(l.longitude),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const result = validateLocation(form);
    if (!result.ok) {
      const messages = { empty: t.locations.empty, latitude: t.locations.latitudeError, longitude: t.locations.longitudeError, coordinates: t.locations.coordinatesError };
      Alert.alert(t.common.error, messages[result.error]);
      return;
    }
    const ok = editingId !== null ? await updateLocation(editingId, result.value) : await addLocation(contactId, result.value);
    if (ok) {
      setLocations(await getLocations(contactId));
      setModalVisible(false);
    } else {
      Alert.alert(t.common.error, t.locations.saveError);
    }
  };

  const handleRemove = (l: ContactLocation) => {
    Alert.alert(t.locations.deleteTitle, t.locations.deleteConfirm(locationSummary(l)), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete, style: 'destructive', onPress: async () => {
          await deleteLocation(l.id);
          setLocations(prev => prev.filter(x => x.id !== l.id));
        },
      },
    ]);
  };

  const field = (label: string, key: keyof typeof EMPTY, extra: object = {}) => (
    <>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} style={s.input} value={form[key]} onChangeText={set(key)}
        placeholder={label} placeholderTextColor={colors.placeholder} {...extra} />
    </>
  );

  return (
    <>
      {locations.length === 0 ? (
        <Pressable accessibilityRole="button" style={s.addRow} onPress={openAddModal}>
          <View style={s.addRowIcon} accessible={false} importantForAccessibility="no-hide-descendants"><Ionicons name="add" size={18} color={colors.accent} /></View>
          <Text style={s.addRowLabel}>{t.locations.title}</Text>
        </Pressable>
      ) : (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{t.locations.title}</Text>
            <Pressable accessibilityRole="button" style={s.addButton} onPress={openAddModal} accessibilityLabel={t.locations.addTitle}>
              <AddButtonLabel />
            </Pressable>
          </View>
          {locations.map(l => (
            <View key={l.id} style={styles.row}>
              <View style={styles.info}>
                {typeLabel(l.location_type) ? <Text style={[styles.type, { color: colors.textSecondary }]}>{typeLabel(l.location_type)}</Text> : null}
                <Text style={[styles.place, { color: colors.text }]}>{locationSummary(l) || '—'}</Text>
                {l.latitude != null && l.longitude != null ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{l.latitude}, {l.longitude}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" onPress={() => openEditModal(l)} style={styles.editBtn} accessibilityLabel={t.common.edit}>
                <Text style={[styles.editBtnText, { color: colors.accent }]}>{t.common.edit}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => handleRemove(l)} style={s.removeBtn} accessibilityLabel={t.common.delete}>
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
              <Text style={s.modalTitle}>{editingId !== null ? t.common.edit : t.locations.addTitle}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.fieldLabel}>{t.locations.type}</Text>
                <Dropdown
                  options={LOCATION_TYPES.map(type => ({ label: t.locations[type], value: type }))}
                  value={form.type || null}
                  onSelect={v => set('type')(v ?? '')}
                  allowNull
                  nullLabel={t.locations.typeNone}
                />
                {field(t.locations.address, 'address', { autoFocus: true })}
                {field(t.locations.city, 'city')}
                {field(t.locations.region, 'region')}
                {field(t.locations.country, 'country')}
                {field(t.locations.postalCode, 'postalCode')}
                {field(t.locations.latitude, 'latitude', { keyboardType: Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation' })}
                {field(t.locations.longitude, 'longitude', { keyboardType: Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation' })}
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
  type: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  place: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, marginTop: 2 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 14 },
});
