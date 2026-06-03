import type { PublicVolunteer } from '@/services/webPortal';

export function getVolunteerInitials(name?: string | null, username?: string | null): string {
  const source = name || username || 'V';
  return source.substring(0, 1).toUpperCase();
}

export function getVolunteerDisplayName(vol: Pick<PublicVolunteer, 'full_name' | 'username'>): string {
  return vol.full_name || vol.username;
}

export function formatPublicDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function formatPublicDateLong(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function projectsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} проект выполнен`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} проекта выполнено`;
  return `${count} проектов выполнено`;
}

export const LEVEL_COLORS: Record<number, { fill: string; stroke: string }> = {
  1: { fill: '#c97c3a', stroke: '#a05c20' },
  2: { fill: '#8fa3b1', stroke: '#6b8696' },
  3: { fill: '#e8b84b', stroke: '#c49020' },
  4: { fill: '#8bc34a', stroke: '#5a9e47' },
  5: { fill: '#3d7a2f', stroke: '#2e6323' },
};

export function getLevelColors(level: number) {
  return LEVEL_COLORS[Math.min(5, Math.max(1, level))] ?? LEVEL_COLORS[1];
}
