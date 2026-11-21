import ContactListSkeleton from '../../components/ContactListSkeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseView, serializeView, VIEW_STORAGE_KEY } from '../../utils/viewState';
import ContactActionsMenu from '../../components/ContactActionsMenu';
import { contactActions } from '../../utils/contactActions';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdBanner from '../../components/AdBanner';
import Dropdown from '../../components/Dropdown';
import DeceasedToggle from '../../components/contact/DeceasedToggle';
import { toDisplayDate } from '../../utils/dates';
import { DEFAULT_DOC_TYPE, DOCUMENT_TYPES } from '../../utils/docTypes';
import {
  applyAgeFilter,
  CedulaFilter,
  ContactListItem,
  filterContactsByCedula,
  filterContactsByChildren,
  filterContactsByGender,
  filterContactsByMaritalStatus,
  filterContactsByOrganization,
  filterContactsByPhone,
  filterContactsByRelationshipStatus,
  ChildrenFilter,
  RelationshipStatusFilter,
  GenderFilter,
  getGenderFilterOptions,
  getSearchChips,
  MaritalStatusFilter,
  OrganizationFilter,
  parseSearchFilter,
  PhoneFilter,
  sortContacts,
  SortKey,
  SORT_OPTIONS,
} from '../../utils/contactList';
import FilterPanel, { ActiveFilterChips, FILTER_OFF, selectedLabel, type FilterGroup, type FilterSection } from '../../components/FilterPanel';
import { getContactIdsWithCedula } from '../../utils/cedulaFilter';
import { getContactIdsWithPhone } from '../../utils/phoneFilter';
import { normalizeChildrenCount, RELATIONSHIP_STATUSES, type RelationshipStatus } from '../../utils/syncMapping';
import {
  getAllOrganizations,
  getContactIdsByOrganization,
  getContactIdsWithOrganization,
} from '../../utils/organizationFilter';
import { MaritalStatus, useContacts } from '../../utils/context';
import ContactAvatar from '../../components/ContactAvatar';
import { useAuth } from '../../utils/authContext';
import { requestApi } from '../../utils/apiClient';
import { photoUrlsFrom } from '../../utils/photoApi';
import { showError } from '../../utils/showError';
import { useToast } from '../../utils/toast';
import { useTheme } from '../../utils/theme';
import { useI18n } from '../../utils/i18n';
import { listLabel } from '../../utils/listLabels';
import { useResponsive } from '../../utils/responsive';
import { calcularEdad, edadEnFecha } from '../../utils/contactUtils';
import { rescheduleExpiredBirthdayNotifications } from '../../utils/notifications';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('first_name');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>(null);
  const [birthdateFilter, setBirthdateFilter] = useState<'all' | 'with' | 'without'>('all');
  const [cedulaFilter, setCedulaFilter] = useState<CedulaFilter>({ mode: 'all' });
  const [cedulaIds, setCedulaIds] = useState<Set<string>>(new Set());
  const [phoneFilter, setPhoneFilter] = useState<PhoneFilter>({ mode: 'all' });
  const [phoneIds, setPhoneIds] = useState<Set<string>>(new Set());
  const [organizationFilter, setOrganizationFilter] = useState<OrganizationFilter>({ mode: 'all' });
  const [orgIds, setOrgIds] = useState<Set<string>>(new Set());
  const [specificOrgIds, setSpecificOrgIds] = useState<Set<string>>(new Set());
  const [organizations, setOrganizations] = useState<{ organization_id: string; name: string }[]>([]);
  const [maritalStatusFilter, setMaritalStatusFilter] = useState<MaritalStatusFilter>({ mode: 'all' });
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipStatusFilter>(null);
  const [childrenFilter, setChildrenFilter] = useState<ChildrenFilter>({ mode: 'all' });

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  // New contacts start as single with no children; the user changes it when known.
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>('SINGLE');
  const [childrenCount, setChildrenCount] = useState('0');
  const [deceased, setDeceased] = useState(false);
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatus[]>([]);

  const [hasDoc, setHasDoc] = useState(false);
  const [docType, setDocType] = useState<string>(DEFAULT_DOC_TYPE);
  const [cardNumber, setCardNumber] = useState('');

  const router = useRouter();
  const { contacts, contactsLoading, fetchContacts, createContact, getMaritalStatuses, addIdentityCard, searchContacts } = useContacts();
  const { t, lang } = useI18n();
  const showToast = useToast();
  const { apiSession } = useAuth();
  // Photos are not part of the local data: the signed URLs come from the API and expire after an hour.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const loadPhotoUrls = useCallback(async () => {
    if (!apiSession) { setPhotoUrls({}); return; }
    const res = await requestApi('/api/contacts?limit=100000');
    if (res.status === 200) setPhotoUrls(photoUrlsFrom(res.data));
  }, [apiSession]);
  const { isDesktop, isTablet, r } = useResponsive();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [searchResults, setSearchResults] = React.useState<ContactListItem[]>([]);
  // Query the current results belong to; differs from searchQuery while the debounced search runs.
  const [settledQuery, setSettledQuery] = React.useState('');
  const [actionsFor, setActionsFor] = React.useState<any>(null);
  const [viewReady, setViewReady] = React.useState(false);
  const [organizationsLoaded, setOrganizationsLoaded] = React.useState(false);
  const genderFilterOptions = React.useMemo(() => getGenderFilterOptions(t), [t]);

  React.useEffect(() => {
    fetchContacts().then(loaded => {
      rescheduleExpiredBirthdayNotifications(loaded);
    });
  }, [fetchContacts]);

  const refreshCedulaIds = React.useCallback(async () => {
    const ids = await getContactIdsWithCedula();
    setCedulaIds(ids);
  }, []);

  const refreshPhoneIds = React.useCallback(async () => {
    setPhoneIds(await getContactIdsWithPhone());
  }, []);

  const refreshOrganizationData = React.useCallback(async () => {
    const [ids, orgs] = await Promise.all([
      getContactIdsWithOrganization(),
      getAllOrganizations(),
    ]);
    setOrgIds(ids);
    setOrganizations(orgs);
    setOrganizationsLoaded(true);
  }, []);

  React.useEffect(() => {
    getMaritalStatuses().then(setMaritalStatuses);
  }, [getMaritalStatuses]);

  React.useEffect(() => {
    refreshCedulaIds();
    refreshPhoneIds();
    refreshOrganizationData();
  }, [refreshCedulaIds, refreshPhoneIds, refreshOrganizationData, contacts]);

  React.useEffect(() => {
    if (organizationFilter.mode !== 'specific' || !organizationFilter.organizationId) {
      setSpecificOrgIds(new Set());
      return;
    }
    let cancelled = false;
    getContactIdsByOrganization(organizationFilter.organizationId).then(ids => {
      if (!cancelled) setSpecificOrgIds(ids);
    });
    return () => { cancelled = true; };
  }, [organizationFilter, contacts]);

  // Restore the sort and filters of the last session (search text is not remembered).
  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIEW_STORAGE_KEY)
      .then(parseView, () => parseView(null))
      .then(saved => {
        if (cancelled) return;
        setSortKey(saved.sortKey);
        setGenderFilter(saved.genderFilter);
        setBirthdateFilter(saved.birthdateFilter);
        setCedulaFilter(saved.cedulaFilter);
        setPhoneFilter(saved.phoneFilter);
        setOrganizationFilter(saved.organizationFilter);
        setMaritalStatusFilter(saved.maritalStatusFilter);
        setRelationshipFilter(saved.relationshipFilter);
        setChildrenFilter(saved.childrenFilter);
        setViewReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Save it on every change, but only after restoring so the defaults never overwrite it.
  React.useEffect(() => {
    if (!viewReady) return;
    AsyncStorage.setItem(VIEW_STORAGE_KEY, serializeView({
      sortKey, genderFilter, birthdateFilter, cedulaFilter, phoneFilter, organizationFilter,
      maritalStatusFilter, relationshipFilter, childrenFilter,
    })).catch(() => {});
  }, [viewReady, sortKey, genderFilter, birthdateFilter, cedulaFilter, phoneFilter, organizationFilter,
    maritalStatusFilter, relationshipFilter, childrenFilter]);

  // A remembered organization or marital status may no longer exist: drop it instead of
  // showing an empty list with no way to tell why.
  React.useEffect(() => {
    if (organizationsLoaded && organizationFilter.mode === 'specific'
      && !organizations.some(o => o.organization_id === organizationFilter.organizationId)) {
      setOrganizationFilter({ mode: 'all' });
    }
  }, [organizationsLoaded, organizations, organizationFilter]);

  React.useEffect(() => {
    if (maritalStatuses.length > 0 && maritalStatusFilter.mode === 'specific'
      && !maritalStatuses.some(m => m.status_id === maritalStatusFilter.statusId)) {
      setMaritalStatusFilter({ mode: 'all' });
    }
  }, [maritalStatuses, maritalStatusFilter]);

  const showChips = React.useMemo(
    () => searchQuery.split('&').filter(p => p.trim()).length > 1 || parseSearchFilter(searchQuery).type === 'age',
    [searchQuery],
  );

  // Web: Ctrl/Cmd+K focuses the search field
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const chips = React.useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];
    return getSearchChips(searchQuery, t.contacts.searchAgeLabel);
  }, [searchQuery, t.contacts.searchAgeLabel]);

  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) { setSearchResults([]); return; }

    const parts = trimmed.split('&').map(p => p.trim()).filter(Boolean);
    const timer = setTimeout(async () => {
      const resultSets: ContactListItem[][] = await Promise.all(
        parts.map(part => {
          const f = parseSearchFilter(part);
          if (f.type === 'age') return Promise.resolve(applyAgeFilter(contacts, f.op, f.value));
          return searchContacts(part);
        })
      );
      if (resultSets.length === 0) { setSearchResults([]); setSettledQuery(trimmed); return; }
      const idSets = resultSets.map(r => new Set(r.map((c: ContactListItem) => c.contact_id)));
      setSearchResults(resultSets[0].filter((c: ContactListItem) => idSets.every(s => s.has(c.contact_id))));
      setSettledQuery(trimmed);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, searchContacts, contacts]);

  const handleRefresh = React.useCallback(async () => {
    await fetchContacts();
    await refreshCedulaIds();
    await refreshPhoneIds();
    await refreshOrganizationData();
    await loadPhotoUrls();
  }, [fetchContacts, refreshCedulaIds, refreshPhoneIds, refreshOrganizationData, loadPhotoUrls]);

  useFocusEffect(useCallback(() => {
    fetchContacts();
    loadPhotoUrls();
    setModalVisible(false);
    setSortModalVisible(false);
  }, [loadPhotoUrls]));

  const baseContacts = searchQuery.trim() ? searchResults : contacts;
  const genderFiltered = filterContactsByGender(baseContacts, genderFilter);
  const birthdateFiltered = birthdateFilter === 'all'
    ? genderFiltered
    : genderFiltered.filter(c => {
      const hasBirthdate = !!(c.birthdate && String(c.birthdate).trim());
      return birthdateFilter === 'with' ? hasBirthdate : !hasBirthdate;
    });
  const cedulaFiltered = filterContactsByCedula(birthdateFiltered, cedulaFilter, cedulaIds);
  const phoneFiltered = filterContactsByPhone(cedulaFiltered, phoneFilter, phoneIds);
  const organizationFiltered = filterContactsByOrganization(phoneFiltered, organizationFilter, orgIds, specificOrgIds);
  const maritalFiltered = filterContactsByMaritalStatus(organizationFiltered, maritalStatusFilter);
  const relationshipFiltered = filterContactsByRelationshipStatus(maritalFiltered, relationshipFilter);
  const childrenFiltered = filterContactsByChildren(relationshipFiltered, childrenFilter);
  const filteredContacts = sortContacts(childrenFiltered, sortKey);

  const sections = React.useMemo(() => {
    if (filteredContacts.length === 0) return [];
    const isAgeSort = sortKey === 'age_asc' || sortKey === 'age_desc';
    const isInsertionSort = sortKey === 'insertion_asc' || sortKey === 'insertion_desc';
    if (isAgeSort || isInsertionSort) return [{ title: '', data: filteredContacts }];
    const map = new Map<string, ContactListItem[]>();
    for (const c of filteredContacts) {
      const letter = sortKey === 'surname'
        ? (c.surname?.[0]?.toUpperCase() ?? '#')
        : (c.first_name?.[0]?.toUpperCase() ?? '#');
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredContacts, sortKey]);


  const clearAllFilters = () => {
    setGenderFilter(null);
    setBirthdateFilter('all');
    setCedulaFilter({ mode: 'all' });
    setPhoneFilter({ mode: 'all' });
    setOrganizationFilter({ mode: 'all' });
    setMaritalStatusFilter({ mode: 'all' });
    setRelationshipFilter(null);
    setChildrenFilter({ mode: 'all' });
  };

  const openFilters = () => {
    // The marital status options come from the database, so load them before opening.
    getMaritalStatuses().then(setMaritalStatuses).catch(() => {});
    setFilterModalVisible(true);
  };

  // Filters grouped by what they describe; the person's situation comes first.
  const filterSections = React.useMemo<FilterSection[]>(() => {
    const tri = (withLabel: string, withoutLabel: string, allLabel = t.contacts.all) => [
      { key: 'all', label: allLabel },
      { key: 'with', label: withLabel },
      { key: 'without', label: withoutLabel },
    ];
    const person: FilterGroup[] = [
      {
        key: 'marital',
        label: t.contacts.maritalFilter,
        selectedKey: maritalStatusFilter.mode === 'specific' ? (maritalStatusFilter.statusId ?? 'all') : maritalStatusFilter.mode,
        options: [
          { key: 'all', label: t.contacts.all },
          { key: 'with', label: t.contacts.maritalFilterWith },
          ...maritalStatuses.map(s => ({ key: s.status_id, label: listLabel('marital', lang, s.status_id, s.marital_status) })),
          { key: 'without', label: t.contacts.maritalFilterWithout },
        ],
        onSelect: key => setMaritalStatusFilter(
          key === 'all' || key === 'with' || key === 'without' ? { mode: key } : { mode: 'specific', statusId: key },
        ),
      },
      {
        key: 'relationship',
        label: t.contacts.relationshipStatus,
        selectedKey: relationshipFilter ?? 'all',
        options: [
          { key: 'all', label: t.contacts.all },
          { key: 'SINGLE', label: t.contacts.relationshipSingle },
          { key: 'PARTNERED', label: t.contacts.relationshipPartnered },
          { key: 'COHABITING', label: t.contacts.relationshipFilterCohabiting },
          { key: 'UNSPECIFIED', label: t.common.unspecified },
        ],
        onSelect: key => setRelationshipFilter(key === 'all' ? null : (key as RelationshipStatusFilter)),
      },
      {
        key: 'children',
        label: t.contacts.children,
        selectedKey: childrenFilter.mode,
        options: tri(t.contacts.childrenFilterWith, t.contacts.childrenFilterWithout),
        onSelect: key => setChildrenFilter({ mode: key as 'all' | 'with' | 'without' }),
      },
      {
        key: 'gender',
        label: t.contacts.gender,
        selectedKey: genderFilter ?? 'all',
        options: genderFilterOptions.map(o => ({ key: o.value ?? 'all', label: o.label })),
        onSelect: key => setGenderFilter(key === 'all' ? null : (key as GenderFilter)),
      },
    ];
    const data: FilterGroup[] = [
      {
        key: 'phone',
        label: t.contacts.phoneFilter,
        selectedKey: phoneFilter.mode,
        options: tri(t.contacts.phoneFilterWith, t.contacts.phoneFilterWithout),
        onSelect: key => setPhoneFilter({ mode: key as 'all' | 'with' | 'without' }),
      },
      {
        key: 'doc',
        label: t.contacts.docFilter,
        selectedKey: cedulaFilter.mode,
        options: tri(t.contacts.docFilterWith, t.contacts.docFilterWithout),
        onSelect: key => setCedulaFilter({ mode: key as 'all' | 'with' | 'without' }),
      },
      {
        key: 'birthdate',
        label: t.contacts.birthdate,
        selectedKey: birthdateFilter,
        options: tri(t.contacts.birthdateWith, t.contacts.birthdateWithout, t.contacts.birthdateAll),
        onSelect: key => setBirthdateFilter(key as 'all' | 'with' | 'without'),
      },
      {
        key: 'organization',
        label: t.contacts.orgFilter,
        selectedKey: organizationFilter.mode,
        options: [
          ...tri(t.contacts.orgFilterWith, t.contacts.orgFilterWithout),
          { key: 'specific', label: t.contacts.orgFilterSpecific },
        ],
        onSelect: key => setOrganizationFilter(prev => ({
          mode: key as OrganizationFilter['mode'],
          organizationId: key === 'specific' ? prev.organizationId : undefined,
        })),
        extra: organizationFilter.mode === 'specific' ? (
          <View style={styles.orgPickerWrapper}>
            <Dropdown
              options={organizations.map(o => ({ label: o.name, value: o.organization_id }))}
              value={organizationFilter.organizationId ?? null}
              onSelect={(val) => setOrganizationFilter({ mode: 'specific', organizationId: val ?? undefined })}
              placeholder={t.contacts.orgFilterSelectPlaceholder}
            />
          </View>
        ) : undefined,
      },
    ];
    return [
      { title: t.contactList.filterSectionPerson, groups: person },
      { title: t.contactList.filterSectionData, groups: data },
    ];
  }, [t, lang, maritalStatuses, maritalStatusFilter, relationshipFilter, childrenFilter, genderFilter, genderFilterOptions,
      phoneFilter, cedulaFilter, birthdateFilter, organizationFilter, organizations]);

  const activeFilterGroups = React.useMemo(
    () => filterSections.flatMap(section => section.groups).filter(g => g.selectedKey !== FILTER_OFF),
    [filterSections],
  );
  const activeFilterChips = activeFilterGroups.map(g => ({ key: g.key, text: `${g.label}: ${selectedLabel(g)}` }));
  const removeFilter = (key: string) => {
    filterSections.flatMap(section => section.groups).find(g => g.key === key)?.onSelect(FILTER_OFF);
  };

  const formatBirthdate = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setBirthdate(formatted);
  };

  const handleOpenModal = async () => {
    const statuses = await getMaritalStatuses();
    setMaritalStatuses(statuses);
    setFirstName('');
    setMiddleName('');
    setSurname('');
    setBirthdate('');
    setGender(null);
    setSelectedStatusId(null);
    setRelationshipStatus('SINGLE');
    setChildrenCount('0');
    setDeceased(false);
    setHasDoc(false);
    setDocType(DEFAULT_DOC_TYPE);
    setCardNumber('');
    setModalVisible(true);
  };

  const handleSaveContact = async () => {
    if (!firstName.trim() || !surname.trim()) {
      showError(t.common.error, t.contacts.nameRequired);
      return;
    }
    const children = normalizeChildrenCount(childrenCount);
    if (childrenCount.trim() && children === null) {
      showError(t.common.error, t.contacts.childrenInvalid);
      return;
    }

    try {
      const newContact = await createContact({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        surname: surname.trim(),
        birthdate: birthdate.trim() || undefined,
        gender: gender ?? undefined,
        status_id: selectedStatusId ?? undefined,
        relationship_status: relationshipStatus,
        children_count: children,
        deceased,
      });

      if (newContact) {
        if (hasDoc && cardNumber.trim()) {
          await addIdentityCard(newContact.contact_id, docType, cardNumber.trim());
        }
        setModalVisible(false);
        await fetchContacts();
        router.push(`/contact/${newContact.contact_id}`);
      } else {
        showError(t.common.error, t.contacts.createError);
      }
    } catch (error) {
      showError(t.common.error, error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{
        headerTitle: t.tabs.contacts,
        headerLargeTitle: true,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 20, marginRight: 12 }}>
            <Pressable accessibilityRole="button" onPress={handleRefresh} onLongPress={() => showToast(t.common.refresh)} hitSlop={12} accessibilityLabel={t.common.refresh}>
              <Ionicons name="refresh" size={20} color={colors.accent} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openFilters} onLongPress={() => showToast(t.contactList.filters)} hitSlop={12} accessibilityLabel={t.contactList.filters}>
              <Ionicons name="filter" size={20} color={colors.accent} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSortModalVisible(true)} onLongPress={() => showToast(t.contactList.sortBy)} hitSlop={12} accessibilityLabel={t.contactList.sortBy}>
              <Ionicons name="swap-vertical" size={20} color={colors.accent} />
            </Pressable>
          </View>
        ),
      }} />

      <View style={styles.innerWrap}>
        {/* Search bar */}
        <View style={[styles.searchWrap, isDesktop && styles.searchWrapDesktop, { backgroundColor: colors.bg }]}>
          <View style={[styles.searchContainer, isDesktop && styles.searchContainerDesktop, { backgroundColor: colors.surface2, borderColor: searchFocused ? colors.accentDecor : colors.border }]}>
            <Ionicons name="search" size={16} color={colors.placeholder} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyPress={(e) => { if (e.nativeEvent.key === 'Escape') setSearchQuery(''); }}
              autoCorrect={false}
              spellCheck={false}
              accessibilityRole="search"
              accessibilityLabel={t.contacts.search}
              accessibilityHint={t.contacts.searchA11yHint}
              placeholder={t.contacts.searchHint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel={t.common.clearSearch} onPress={() => setSearchQuery('')} hitSlop={8} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {showChips && chips.length > 0 && (
          <View style={[styles.activeFilterRow, isDesktop && styles.activeFilterRowDesktop]}>
            {chips.map((chip, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Text style={[styles.chipAnd, { color: colors.textSecondary }]}>&amp;</Text>}
                <View style={[styles.activeFilterChip, { backgroundColor: colors.accentSubtle }]}>
                  <Text style={[styles.activeFilterText, { color: colors.accent }]}>{chip}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}

        {activeFilterChips.length > 0 && (
          <View style={[styles.appliedFilters, isDesktop && styles.activeFilterRowDesktop]}>
            <ActiveFilterChips chips={activeFilterChips} removeLabel={t.contactList.filterRemove} onRemove={removeFilter} />
          </View>
        )}

        <Text style={[styles.contactCount, isDesktop && styles.contactCountDesktop, { color: colors.textSecondary }]}>
          {filteredContacts.length} {filteredContacts.length === 1 ? t.contactList.contact : t.contactList.contacts}
        </Text>

        <View style={{ flex: 1 }}>
          {contactsLoading ? <ContactListSkeleton /> : (
          <SectionList
            sections={sections}
            extraData={photoUrls}
            keyExtractor={(item) => item.contact_id}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section: { title } }) =>
              title ? (
                <View style={[styles.sectionHeader, { backgroundColor: colors.bg }, isDesktop && styles.sectionHeaderDesktop, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>{title}</Text>
                </View>
              ) : null
            }
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, isTablet && !isDesktop && styles.separatorTablet, isDesktop && styles.separatorDesktop, { backgroundColor: colors.separatorFine }]} />
            )}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button"
                style={({ pressed }) => [
                  styles.contactItem,
                  isTablet && !isDesktop && styles.contactItemTablet,
                  isDesktop && styles.contactItemDesktop,
                  { backgroundColor: pressed ? colors.surface2 : colors.surface },
                ]}
                onPress={() => router.push(`/contact/${item.contact_id}`)}
              >
                <ContactAvatar firstName={item.first_name} surname={item.surname} size={r(44, 46, 48)} photoUrl={photoUrls[item.contact_id]} />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, isDesktop && styles.contactNameDesktop, { color: colors.text }]} numberOfLines={1}>
                    {`${item.first_name ?? ''} ${item.middle_name ?? ''} ${item.surname ?? ''}`.replace(/\s+/g, ' ').trim()}
                  </Text>
                  {!!item.deceased && (
                    <Text style={[styles.contactSecondary, { color: colors.destructiveText }]}>{t.contacts.deceased}</Text>
                  )}
                  {(sortKey === 'age_asc' || sortKey === 'age_desc') && (
                    <Text style={[styles.contactSecondary, { color: colors.textSecondary }]}>
                      {calcularEdad(item.birthdate, t.age) ?? t.contactList.ageNotRecorded}
                    </Text>
                  )}
                  {searchQuery.trim() && (item.achievement || item.organization_name) ? (
                    <>
                      {item.achievement ? (
                        <Text style={[styles.contactSecondaryBlue, { color: colors.accent }]}>{item.achievement}</Text>
                      ) : null}
                      {item.organization_name ? (
                        <Text style={[styles.contactSecondaryBlue, { color: colors.accent }, { fontWeight: '600' }]}>{item.organization_name}</Text>
                      ) : null}
                      {item.organization_date ? (
                        <Text style={[styles.contactSecondaryLight, { color: colors.accent }]}>
                          {toDisplayDate(item.organization_date)}
                          {(() => {
                            if (!item.birthdate) return '';
                            const e = edadEnFecha(item.birthdate, item.organization_date);
                            if (!e) return '';
                            const parts = [];
                            if (e.years > 0) parts.push(`${e.years} ${e.years === 1 ? t.contactList.year : t.contactList.years}`);
                            if (e.months > 0) parts.push(`${e.months} ${e.months === 1 ? t.contactList.month : t.contactList.months}`);
                            if (e.days > 0) parts.push(`${e.days} ${e.days === 1 ? t.contactList.day : t.contactList.days}`);
                            return parts.length ? ` · ${parts.join(', ')}` : '';
                          })()}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </View>
                {contactActions(item.primary_phone, item.primary_email, !item.primary_phone_inactive).length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t.contactList.moreActions}: ${item.first_name} ${item.surname}`}
                    hitSlop={4}
                    onPress={() => setActionsFor(item)}
                    style={({ pressed }) => [styles.moreButton, pressed && { backgroundColor: colors.surface2 }]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={() => searchQuery.trim() && settledQuery !== searchQuery.trim() ? null : (
              <View style={styles.emptyContainer}>
                {contacts.length > 0 ? (
                  <>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.contacts.noResults}</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.contacts.noResultsHint}</Text>
                    {searchQuery.length > 0 && (
                      <Pressable accessibilityRole="button" onPress={() => setSearchQuery('')} style={styles.emptyAction}>
                        <Text style={[styles.emptyActionText, { color: colors.accent }]}>{t.common.clearSearch}</Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.contacts.empty}</Text>
                )}
              </View>
            )}
            contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          />
          )}

          <Pressable accessibilityRole="button" style={[styles.fab, isDesktop && styles.fabDesktop, { backgroundColor: colors.accentDecor, shadowColor: colors.accentDecor }]} onPress={handleOpenModal} accessibilityLabel={t.contacts.newContact}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <AdBanner />

      <ContactActionsMenu
        visible={!!actionsFor}
        name={actionsFor ? `${actionsFor.first_name ?? ''} ${actionsFor.surname ?? ''}`.trim() : ''}
        phone={actionsFor?.primary_phone ?? ''}
        email={actionsFor?.primary_email ?? ''}
        canCall={!actionsFor?.primary_phone_inactive}
        onClose={() => setActionsFor(null)}
      />

      {/* Sort modal */}
      <Modal
        animationType="fade"
        transparent
        visible={sortModalVisible}
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable accessible={false} style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setSortModalVisible(false)}>
          <View
            style={[styles.sortSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.sortHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sortTitle, { color: colors.text }]} accessibilityRole="header">{t.contactList.sortBy}</Text>
            </View>
            {SORT_OPTIONS.map((opt, i) => {
              const selected = sortKey === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.sortOption,
                    i < SORT_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    pressed && { backgroundColor: colors.surface2 },
                  ]}
                  onPress={() => { setSortKey(opt.key); setSortModalVisible(false); }}
                >
                  <Text style={[styles.sortOptionText, { color: selected ? colors.accent : colors.text }, selected && styles.sortOptionTextSelected]}>
                    {(t.contactList as any)[opt.transKey]}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Filter modal */}
      <Modal
        animationType="fade"
        transparent
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable accessible={false} style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setFilterModalVisible(false)}>
          <View
            style={[styles.filterSheet, { backgroundColor: colors.bg, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <FilterPanel
              title={t.contactList.filters}
              resultsLabel={`${filteredContacts.length} ${filteredContacts.length === 1 ? t.contactList.contact : t.contactList.contacts}`}
              clearLabel={t.contactList.filtersClear}
              canClear={activeFilterGroups.length > 0}
              onClear={clearAllFilters}
              sections={filterSections}
            />
          </View>
        </Pressable>
      </Modal>

      {/* New contact sheet */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <View style={[styles.sheetOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.bg }, isDesktop ? styles.sheetDesktop : { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t.contacts.newContact}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.firstName} <Text style={[styles.required, { color: colors.destructiveText }]}>{t.common.required}</Text></Text>
              <TextInput accessibilityLabel={t.contacts.firstNamePlaceholder}
                style={[styles.input, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, color: colors.text }]}
                placeholder={t.contacts.firstNamePlaceholder}
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.middleName}</Text>
              <TextInput accessibilityLabel={t.contacts.middleNamePlaceholder}
                style={[styles.input, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, color: colors.text }]}
                placeholder={t.contacts.middleNamePlaceholder}
                value={middleName}
                onChangeText={setMiddleName}
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.surname} <Text style={[styles.required, { color: colors.destructiveText }]}>{t.common.required}</Text></Text>
              <TextInput accessibilityLabel={t.contacts.surnamePlaceholder}
                style={[styles.input, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, color: colors.text }]}
                placeholder={t.contacts.surnamePlaceholder}
                value={surname}
                onChangeText={setSurname}
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.gender}</Text>
              <View style={styles.genderRow}>
                {(['MALE', 'FEMALE'] as const).map(g => (
                  <Pressable accessibilityRole="button"
                    key={g}
                    style={[styles.genderChip, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }, gender === g && [styles.genderChipSelected, { backgroundColor: colors.accentFill }]]}
                    onPress={() => setGender(prev => prev === g ? null : g)}
                  >
                    <Text style={[styles.genderChipText, gender === g && styles.genderChipTextSelected]}>
                      {g === 'MALE' ? t.contacts.male : t.contacts.female}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.birthdate}</Text>
              <TextInput accessibilityLabel={t.contacts.birthdatePlaceholder}
                style={[styles.input, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, color: colors.text }]}
                placeholder={t.contacts.birthdatePlaceholder}
                value={birthdate}
                onChangeText={formatBirthdate}
                placeholderTextColor={colors.placeholder}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                maxLength={10}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.maritalStatus}</Text>
              <Dropdown
                options={maritalStatuses.map(s => ({ label: listLabel('marital', lang, s.status_id, s.marital_status), value: s.status_id }))}
                value={selectedStatusId}
                onSelect={setSelectedStatusId}
                allowNull
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.relationshipStatus}</Text>
              <View style={styles.genderRow}>
                {RELATIONSHIP_STATUSES.map(rs => (
                  <Pressable accessibilityRole="button"
                    accessibilityState={{ selected: relationshipStatus === rs }}
                    key={rs}
                    style={[styles.genderChip, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }, styles.relationshipChip, relationshipStatus === rs && [styles.genderChipSelected, { backgroundColor: colors.accentFill }]]}
                    onPress={() => setRelationshipStatus(prev => prev === rs ? null : rs)}
                  >
                    <Text numberOfLines={2} style={[styles.genderChipText, styles.relationshipChipText, relationshipStatus === rs && styles.genderChipTextSelected]}>
                      {rs === 'SINGLE' ? t.contacts.relationshipSingle : rs === 'PARTNERED' ? t.contacts.relationshipPartnered : t.contacts.relationshipCohabiting}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.children}</Text>
              <TextInput accessibilityLabel={t.contacts.children}
                style={[styles.input, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, color: colors.text }]}
                placeholder={t.contacts.childrenPlaceholder}
                value={childrenCount}
                onChangeText={v => setChildrenCount(v.replace(/\D/g, '').slice(0, 2))}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                maxLength={2}
              />

              <DeceasedToggle value={deceased} onChange={setDeceased} />

              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: hasDoc }} style={styles.docToggle} onPress={() => setHasDoc(v => !v)}>
                <View style={[styles.docToggleBox, hasDoc && [styles.docToggleBoxActive, { borderColor: colors.accentFill }, { backgroundColor: colors.accentFill }]]}>
                  {hasDoc && <Ionicons name="checkmark" size={14} color={colors.surface} />}
                </View>
                <Text style={styles.docToggleLabel}>{t.contacts.hasDoc}</Text>
              </Pressable>

              {hasDoc && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.docType}</Text>
                  <Dropdown
                    options={DOCUMENT_TYPES.map(d => ({ label: (t.contactList as any)[d.labelKey], value: d.value }))}
                    value={docType}
                    onSelect={v => v && setDocType(v)}
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.contacts.docNumber}</Text>
                  <TextInput accessibilityLabel={t.contacts.docNumberPlaceholder}
                    style={[styles.input, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, color: colors.text }]}
                    placeholder={t.contacts.docNumberPlaceholder}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="characters"
                  />
                </>
              )}

            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" style={[styles.btn, styles.btnCancel, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.btnCancelText, { color: colors.text }]}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={[styles.btn, styles.btnSave, { backgroundColor: colors.accentFill }]} onPress={handleSaveContact}>
                <Text style={styles.btnSaveText}>{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  innerWrap: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchWrapDesktop: { paddingHorizontal: 32 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    borderWidth: 1,
  },
  searchContainerDesktop: { maxWidth: 600 },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  clearBtn: {
    marginLeft: 6,
    marginRight: -6,
    padding: 8,
  },

  // Filter chips row
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    gap: 6,
  },
  activeFilterRowDesktop: { marginHorizontal: 32 },
  activeFilterChip: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeFilterText: { fontSize: 13, fontWeight: '600' },
  chipAnd: { fontSize: 12, fontWeight: '700' },

  // Count
  contactCount: { fontSize: 12, marginHorizontal: 16, marginBottom: 4 },
  contactCountDesktop: { marginHorizontal: 32 },

  // Section headers
  sectionHeader: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.15)',
  },
  sectionHeaderDesktop: { paddingHorizontal: 32 },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C6C70',
    letterSpacing: 0.5,
  },

  // Row separator
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.15)',
    marginLeft: 72,
  },
  separatorTablet: { marginLeft: 78 },
  separatorDesktop: { marginLeft: 100 },

  // Contact row
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 16,
    backgroundColor: '#fff',
    minHeight: 60,
    gap: 12,
  },
  contactItemTablet: {
    paddingLeft: 20,
    paddingRight: 20,
    minHeight: 62,
  },
  contactItemDesktop: {
    paddingLeft: 32,
    paddingRight: 32,
    minHeight: 64,
  },
  contactItemPressed: { backgroundColor: '#F2F2F7' },
  contactInfo: { flex: 1, justifyContent: 'center' },
  contactName: { fontSize: 16, fontWeight: '500', color: '#000' },
  contactNameDesktop: { fontSize: 18 },
  contactSecondary: { fontSize: 13, color: '#6C6C70', marginTop: 1 },
  contactSecondaryBlue: { fontSize: 13, color: '#0066D6', marginTop: 1 },
  contactSecondaryLight: { fontSize: 12, color: '#0066D6', marginTop: 1 },

  // List
  listContent: { paddingBottom: 100 },
  listContentDesktop: { paddingBottom: 120 },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptyText: { fontSize: 16, color: '#6C6C70', textAlign: 'center', paddingHorizontal: 24 },
  emptyAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  emptyActionText: { fontSize: 16, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 32,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
  },
  fabDesktop: { right: 32, width: 60, height: 60, borderRadius: 30 },

  // Sort / filter modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  orgPickerWrapper: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  moreButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  sortSheet: {
    width: '92%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sortHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  sortTitle: { fontSize: 16, fontWeight: '600' },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sortOptionText: { flex: 1, fontSize: 15 },
  sortOptionTextSelected: { fontWeight: '600' },
  filterSheet: {
    width: '92%',
    maxWidth: 520,
    maxHeight: '85%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  appliedFilters: { marginHorizontal: 16, marginBottom: 8 },

  // Sheet (new contact modal)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    maxHeight: '90%',
  },
  sheetDesktop: {
    maxWidth: 600,
    borderRadius: 14,
    alignSelf: 'center',
    marginBottom: 40,
    width: '100%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60,60,67,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
  },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6C6C70', marginTop: 16, marginBottom: 6, letterSpacing: 0.2 },
  required: { color: '#FF3B30' },
  input: {
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: '#000',
    backgroundColor: '#fff',
    minHeight: 48,
  },

  docToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
  docToggleBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  docToggleBoxActive: { backgroundColor: '#0066D6', borderColor: '#0066D6' },
  docToggleLabel: { fontSize: 15, color: '#000' },

  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#fff',
  },
  genderChipSelected: { backgroundColor: '#0066D6' },
  genderChipText: { fontSize: 15, color: '#333' },
  genderChipTextSelected: { color: '#fff', fontWeight: '600' },
  relationshipChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  relationshipChipText: { fontSize: 14, textAlign: 'center' },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: '#fff' },
  btnSave: { backgroundColor: '#0066D6' },
  btnCancelText: { fontSize: 16, fontWeight: '600', color: '#000' },
  btnSaveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
