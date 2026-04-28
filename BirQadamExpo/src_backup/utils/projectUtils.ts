import { normalizeImageUrl as normalizeBackendImageUrl } from './network';
import { appColors } from '../theme';
import type { Project } from '../types';

export const getVolunteerTypeLabel = (type: string): string => {
  switch (type) {
    case 'social':
      return 'Социальная помощь';
    case 'environmental':
      return 'Экология';
    case 'cultural':
      return 'Культурные мероприятия';
    default:
      return type;
  }
};

export const getVolunteerTypeColor = (type: string): string => {
  switch (type) {
    case 'social':
      return appColors.primary;
    case 'environmental':
      return appColors.primary;
    case 'cultural':
      return '#8B5CF6';
    default:
      return appColors.textMuted;
  }
};

export const normalizeImageUrl = normalizeBackendImageUrl;

export const isProjectCurrentlyActive = (project: Pick<Project, 'status' | 'end_date'>): boolean => {
  const normalizedStatus = (project.status || '').toLowerCase();
  if (['completed', 'cancelled', 'rejected', 'archived', 'closed'].includes(normalizedStatus)) {
    return false;
  }

  if (!project.end_date) {
    return true;
  }

  const endDate = new Date(project.end_date);
  if (Number.isNaN(endDate.getTime())) {
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return endDate >= today;
};

export const getSortLabel = (sort: 'newest' | 'popular' | 'urgent' | 'alphabetical'): string => {
  switch (sort) {
    case 'newest': return 'Новые';
    case 'popular': return 'Популярные';
    case 'urgent': return 'Срочные';
    case 'alphabetical': return 'По алфавиту';
  }
};
