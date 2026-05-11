/** Safe for inserting into Leaflet HTML tooltips / divIcon. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** UUID humans → compact hex; numeric bots → short tail of digits. */
export function playerShortId(userId: string): string {
  if (!userId) return '—';
  if (userId.includes('-')) {
    return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  const digits = userId.replace(/\D/g, '') || userId;
  return digits.length > 6 ? digits.slice(-6) : digits;
}
