let _contacts = $state([]);
let _currentContact = $state(null);
let _loading = $state(false);
let _search = $state('');

export const contacts = {
  get value() { return _contacts; },
  set value(v) { _contacts = v; }
};
export const currentContact = {
  get value() { return _currentContact; },
  set value(v) { _currentContact = v; }
};
export const loading = {
  get value() { return _loading; },
  set value(v) { _loading = v; }
};
export const search = {
  get value() { return _search; },
  set value(v) { _search = v; }
};
