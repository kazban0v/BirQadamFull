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
      return '#3B82F6';
    case 'environmental':
      return '#10B981';
    case 'cultural':
      return '#8B5CF6';
    default:
      return '#6B7280';
  }
};

export const normalizeImageUrl = (url: string | undefined | null): string | undefined => {
  if (!url) return undefined;
  
  // В development режиме заменяем HTTPS на HTTP для локального сервера
  if (__DEV__) {
    // Если URL содержит production домен, заменяем на локальный IP
    if (url.includes('cleanup.almau.edu.kz') || url.includes('birqadam.almau.edu.kz')) {
      return url.replace(/https?:\/\/[^\/]+/, 'http://192.168.0.129:8000');
    }
    // Если URL начинается с HTTPS, заменяем на HTTP
    if (url.startsWith('https://')) {
      return url.replace('https://', 'http://');
    }
  }
  
  return url;
};

export const getSortLabel = (sort: 'newest' | 'popular' | 'urgent' | 'alphabetical'): string => {
  switch (sort) {
    case 'newest': return 'Новые';
    case 'popular': return 'Популярные';
    case 'urgent': return 'Срочные';
    case 'alphabetical': return 'По алфавиту';
  }
};

