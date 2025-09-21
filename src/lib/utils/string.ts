// Utility string functions

/**
 * Masks a string for display, showing only the first and last 4 characters.
 * Example: abcd1234efgh5678 -> abcd…5678
 */
export function mask(v: string): string {
  if (!v) return '';
  return v.length <= 8 ? '********' : `${v.slice(0, 4)}…${v.slice(-4)}`;
}
