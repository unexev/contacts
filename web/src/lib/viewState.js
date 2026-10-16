const KEY = 'contacts.view.v1';

export const SORT_VALUES = ['firstname_az', 'surname_az', 'age_oldest', 'age_youngest', 'recent_newest', 'recent_oldest'];
const TRI = ['', 'yes', 'no'];

export const DEFAULT_VIEW = {
  sortBy: 'firstname_az',
  filterGender: '',
  filterBirthday: '',
  filterIDCard: '',
  filterOrganization: '',
  filterMaritalStatus: ''
};

const VALID = {
  sortBy: (v) => SORT_VALUES.includes(v),
  filterGender: (v) => ['', 'MALE', 'FEMALE', 'NONE'].includes(v),
  filterBirthday: (v) => TRI.includes(v),
  filterIDCard: (v) => TRI.includes(v),
  filterOrganization: (v) => TRI.includes(v),
  filterMaritalStatus: (v) => TRI.includes(v)
};

// Only known keys with known values survive; anything else falls back to defaults.
export function sanitizeView(raw) {
  const view = { ...DEFAULT_VIEW };
  if (!raw || typeof raw !== 'object') return view;
  for (const key of Object.keys(VALID)) {
    if (VALID[key](raw[key])) view[key] = raw[key];
  }
  return view;
}

export function loadView(storage = globalThis.localStorage) {
  try {
    return sanitizeView(JSON.parse(storage.getItem(KEY)));
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

export function saveView(view, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(sanitizeView(view)));
  } catch {
    // Storage unavailable (private mode, quota): the view just won't persist.
  }
}
