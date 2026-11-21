/** Avatar background colors. Each one keeps white initials at 4.5:1 or better (WCAG AA). */
export const AVATAR_COLORS = [
  '#C62828', '#B45309', '#8A6A00', '#1F7A36', '#00707F',
  '#0066CC', '#4B49C4', '#8E3FB5', '#C2185B', '#7A6143',
];

export const AVATAR_FALLBACK = '#6B6B70';

/** Same name, same color: the list and the detail screen must agree. */
export function getAvatarColor(name: string): string {
  if (!name) return AVATAR_FALLBACK;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarColorFor(firstName?: string | null, surname?: string | null): string {
  return getAvatarColor(`${firstName ?? ''}${surname ?? ''}`);
}
