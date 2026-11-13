import { Platform } from 'react-native';

/**
 * Copia texto al portapapeles en todas las plataformas.
 * - Native (Android): expo-clipboard
 * - Web/desktop (Tauri): navigator.clipboard con fallback a execCommand
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (Platform.OS !== 'web') {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return;
  }

  // Web / desktop (Tauri)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }

  // Fallback: execCommand (deprecated pero funciona en webviews)
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(el);
  }
}
