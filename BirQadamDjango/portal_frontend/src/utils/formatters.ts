export function formatDate(value: string | null): string {
  if (!value) return '—';
  
  let date: Date;
  
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [day, month, year] = value.split('.');
    date = new Date(`${year}-${month}-${day}T00:00:00`);
  } else if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(value)) {
    const [datePart, timePart] = value.split(' ');
    const [day, month, year] = datePart.split('.');
    date = new Date(`${year}-${month}-${day}T${timePart}:00`);
  } else {
    date = new Date(value);
  }
  
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getFullImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if ((url.includes('localhost') || url.includes('127.0.0.1')) && url.startsWith('https://')) {
      return url.replace('https://', 'http://');
    }
    return url;
  }
  
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanPath}`;
  } catch (error) {
    console.error('Error building image URL:', error);
    return null;
  }
}
