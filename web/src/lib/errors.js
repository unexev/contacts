// Turns the raw messages thrown by api()/fetch into text the user can act on.
// Network failures surface as a TypeError whose message depends on the browser.
export function friendlyError(err, t) {
  const message = String(err?.message || '');
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message)) return t('errorNetwork');
  if (message === 'Invalid credentials') return t('errorInvalidCredentials');
  if (message === 'Something went wrong') return t('errorServer');
  if (message === 'Invalid request') return t('errorConflict');
  if (message === 'Invalid input') return t('errorInvalidInput');
  return message || t('errorGeneric');
}
