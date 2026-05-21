/**
 * Извлекает человекочитаемое сообщение об ошибке из тела ответа Django / DRF.
 */
export function getApiErrorMessage(data: unknown, fallback = 'Произошла ошибка'): string {
  if (data == null || data === '') {
    return fallback;
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed || fallback;
  }

  if (typeof data !== 'object') {
    return fallback;
  }

  const obj = data as Record<string, unknown>;

  for (const key of ['detail', 'error', 'message'] as const) {
    const value = obj[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    if (Array.isArray(value) && value.length > 0) {
      const parts = value
        .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : ''))
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        return parts.join('\n');
      }
    }
  }

  const nfe = obj.non_field_errors;
  if (Array.isArray(nfe) && nfe.length > 0) {
    const parts = nfe
      .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : ''))
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  const fieldLines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (['detail', 'error', 'message', 'non_field_errors'].includes(key)) {
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      fieldLines.push(`${key}: ${value.trim()}`);
    } else if (Array.isArray(value) && value.length > 0) {
      const parts = value
        .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : ''))
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        fieldLines.push(`${key}: ${parts.join(' ')}`);
      }
    }
  }
  if (fieldLines.length > 0) {
    return fieldLines.join('\n');
  }

  return fallback;
}

/**
 * Сообщение для catch вокруг axios: учитывает response.data и сетевые ошибки.
 */
export function getAxiosErrorMessage(error: unknown, fallback: string): string {
  let responseStatus: number | undefined;

  if (error && typeof error === 'object' && 'response' in error) {
    const response = (
      error as { response?: { data?: unknown; statusText?: string; status?: number } }
    ).response;
    responseStatus = response?.status;

    if (response?.data !== undefined) {
      const extracted = getApiErrorMessage(response.data, '');
      if (extracted.trim()) {
        return extracted;
      }
    }
    if (typeof response?.statusText === 'string' && response.statusText.trim()) {
      return response.statusText.trim();
    }
    if (
      fallback.trim() &&
      responseStatus !== undefined &&
      responseStatus >= 400 &&
      responseStatus < 600
    ) {
      return fallback;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    const m = error.message.trim();
    if (/axioserror|^request failed|network error/i.test(m)) {
      return fallback;
    }
    if (responseStatus != null && responseStatus >= 400) {
      return fallback;
    }
    return m;
  }

  return fallback;
}

export type AxiosErrorPayload = {
  status?: number;
  data?: Record<string, unknown>;
};

/** Статус и JSON-тело ответа axios (для ветвлений вроде 404 / trust_factor). */
export function getAxiosErrorResponse(error: unknown): AxiosErrorPayload | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }
  const raw = (error as { response?: { status?: number; data?: unknown } }).response;
  if (!raw) {
    return undefined;
  }
  const { status, data } = raw;
  const normalizedData =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;
  return { status, data: normalizedData };
}
