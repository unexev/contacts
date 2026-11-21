import { Alert, Platform } from 'react-native';

/** One error dialog everywhere: native alert titled with the localized word for "Error". */
export function showError(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  Alert.alert(title, message);
}
