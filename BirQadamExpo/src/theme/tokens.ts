import type { Ionicons } from '@expo/vector-icons';

/** Скругления — единая шкала по приложению */
export const appRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  tabBar: 32,
  pill: 999,
} as const;

/** Отступы (4-pt сетка) */
export const appSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** Типографика (размеры/вес — далее можно подставлять color: appColors.text) */
export const appTypography = {
  screenTitle: { fontSize: 24, fontWeight: '800' as const, lineHeight: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  subtitle: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  micro: { fontSize: 10, fontWeight: '700' as const, lineHeight: 14 },
} as const;

/** Длительности и пружины для единых анимаций */
export const appMotion = {
  duration: { fast: 200, normal: 280, slow: 360 } as const,
  springBanner: { tension: 72, friction: 11 } as const,
  springCard: { tension: 65, friction: 11 } as const,
} as const;

export type ProjectTypeGlyph = keyof typeof Ionicons.glyphMap;

/** Цвет и иконка типа проекта (каталог, фильтры, карточки) — одна точка правды */
export const projectTypeVisual = {
  social: { color: '#2563EB', icon: 'people' as const satisfies ProjectTypeGlyph },
  environmental: { color: '#16A34A', icon: 'leaf' as const satisfies ProjectTypeGlyph },
  cultural: { color: '#7C3AED', icon: 'color-palette' as const satisfies ProjectTypeGlyph },
  default: { color: '#64748B', icon: 'apps' as const satisfies ProjectTypeGlyph },
} as const;

export function getProjectTypeVisual(type: string): { color: string; icon: ProjectTypeGlyph } {
  if (type === 'social') return projectTypeVisual.social;
  if (type === 'environmental') return projectTypeVisual.environmental;
  if (type === 'cultural') return projectTypeVisual.cultural;
  return projectTypeVisual.default;
}
