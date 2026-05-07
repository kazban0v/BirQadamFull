export type DashboardLanguage = 'ru' | 'en' | 'kk';

/** Строка вида «12 проектов» для блока «Предстоящие возможности» на главной */
export function formatFilteredProjectsCount(count: number, language: DashboardLanguage): string {
  if (language === 'en') {
    return count === 1 ? '1 project' : `${count} projects`;
  }

  if (language === 'kk') {
    if (count === 0) {
      return '0 жобалар';
    }
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return `${count} жоба`;
    }
    return `${count} жобалар`;
  }

  if (count === 0) {
    return '0 проектов';
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} проект`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} проекта`;
  }
  return `${count} проектов`;
}
