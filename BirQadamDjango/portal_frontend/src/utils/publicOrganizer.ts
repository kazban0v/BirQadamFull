import type { PublicOrganizer } from '@/services/webPortal';

export function getOrganizerDisplayName(org: Pick<PublicOrganizer, 'organization_name' | 'id'>): string {
  return org.organization_name?.trim() || `Организация #${org.id}`;
}

export function getOrganizerInitials(name: string): string {
  const source = name?.trim() || 'O';
  return source.substring(0, 1).toUpperCase();
}

export function formatPublicDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function projectsCountLabel(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} проектов`;
  if (n1 === 1) return `${count} проект`;
  if (n1 >= 2 && n1 <= 4) return `${count} проекта`;
  return `${count} проектов`;
}
