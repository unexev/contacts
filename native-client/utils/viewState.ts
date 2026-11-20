/**
 * The contact list view (sort + filters) that is remembered between sessions.
 * Search text is deliberately not part of it. No react-native imports so it can
 * run under `node --test`; anything unknown or malformed falls back to defaults.
 */
import type {
  ChildrenFilter, CedulaFilter, GenderFilter, MaritalStatusFilter, OrganizationFilter,
  PhoneFilter, RelationshipStatusFilter, SortKey,
} from './contactList';

export const VIEW_STORAGE_KEY = 'contacts.view.v1';

export interface ListView {
  sortKey: SortKey;
  genderFilter: GenderFilter;
  birthdateFilter: 'all' | 'with' | 'without';
  cedulaFilter: CedulaFilter;
  phoneFilter: PhoneFilter;
  organizationFilter: OrganizationFilter;
  maritalStatusFilter: MaritalStatusFilter;
  relationshipFilter: RelationshipStatusFilter;
  childrenFilter: ChildrenFilter;
}

export const DEFAULT_VIEW: ListView = {
  sortKey: 'first_name',
  genderFilter: null,
  birthdateFilter: 'all',
  cedulaFilter: { mode: 'all' },
  phoneFilter: { mode: 'all' },
  organizationFilter: { mode: 'all' },
  maritalStatusFilter: { mode: 'all' },
  relationshipFilter: null,
  childrenFilter: { mode: 'all' },
};

const SORT_KEYS: SortKey[] = ['first_name', 'surname', 'age_asc', 'age_desc', 'insertion_desc', 'insertion_asc'];
const TRI = ['all', 'with', 'without'] as const;
const GENDERS = ['MALE', 'FEMALE', 'UNSPECIFIED'];
const RELATIONSHIPS = ['SINGLE', 'PARTNERED', 'COHABITING', 'UNSPECIFIED'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const tri = (v: unknown) => (TRI as readonly unknown[]).includes(v) ? (v as 'all' | 'with' | 'without') : 'all';

/** A `{ mode }` filter with only the three basic modes. */
function triFilter(v: any): { mode: 'all' | 'with' | 'without' } {
  return { mode: tri(v?.mode) };
}

/** `{ mode, <idKey> }` where `specific` needs a plausible id, otherwise it is off. */
function specificFilter<K extends string>(v: any, idKey: K): { mode: 'all' | 'with' | 'without' | 'specific' } & { [P in K]?: string } {
  if (v?.mode === 'specific') {
    return typeof v[idKey] === 'string' && ID_RE.test(v[idKey])
      ? ({ mode: 'specific', [idKey]: v[idKey] } as any)
      : ({ mode: 'all' } as any);
  }
  return { mode: tri(v?.mode) } as any;
}

export function sanitizeView(raw: unknown): ListView {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  return {
    sortKey: SORT_KEYS.includes(r.sortKey) ? r.sortKey : DEFAULT_VIEW.sortKey,
    genderFilter: GENDERS.includes(r.genderFilter) ? r.genderFilter : null,
    birthdateFilter: tri(r.birthdateFilter),
    cedulaFilter: triFilter(r.cedulaFilter),
    phoneFilter: triFilter(r.phoneFilter),
    organizationFilter: specificFilter(r.organizationFilter, 'organizationId'),
    maritalStatusFilter: specificFilter(r.maritalStatusFilter, 'statusId'),
    relationshipFilter: RELATIONSHIPS.includes(r.relationshipFilter) ? r.relationshipFilter : null,
    childrenFilter: triFilter(r.childrenFilter),
  };
}

export function parseView(text: string | null | undefined): ListView {
  try {
    return sanitizeView(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

export function serializeView(view: ListView): string {
  return JSON.stringify(sanitizeView(view));
}

export function isDefaultView(view: ListView): boolean {
  return serializeView(view) === serializeView(DEFAULT_VIEW);
}
