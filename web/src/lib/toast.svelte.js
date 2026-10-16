export const toast = $state({ message: '' });

let timer;

export function showToast(message, ms = 2000) {
  toast.message = message;
  clearTimeout(timer);
  timer = setTimeout(() => { toast.message = ''; }, ms);
}
