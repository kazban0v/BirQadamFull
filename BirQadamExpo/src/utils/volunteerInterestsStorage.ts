import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@birqadam:volunteer_interests_v1';

export type VolunteerInterestId = 'social' | 'environmental' | 'cultural';

/** Когда подключаться: новые/скоро стартующие против уже активных проектов. */
export type ProjectTimingPreference = 'any' | 'starting_soon' | 'ongoing';

/** Размер сообщества участников проекта в подборках. */
export type TeamSizePreference = 'any' | 'small' | 'large';

export interface VolunteerInterestsState {
  /** Выбранные направления; пустой массив = «нет персональных» */
  selectedIds: VolunteerInterestId[];
  projectTimingPreference: ProjectTimingPreference;
  teamSizePreference: TeamSizePreference;
  /** Пользователь закрыл шторку («Позже» или «Готово»); не показываем авто-снова */
  promptCompleted: boolean;
}

/** Часть состояния, которую сохраняет нижний лист перед закрытием. */
export type VolunteerInterestTunePayload = Pick<
  VolunteerInterestsState,
  'selectedIds' | 'projectTimingPreference' | 'teamSizePreference'
>;

export const defaultVolunteerInterestsState = (): VolunteerInterestsState => ({
  selectedIds: [],
  projectTimingPreference: 'any',
  teamSizePreference: 'any',
  promptCompleted: false,
});

export function normalizeProjectTimingPreference(
  raw: unknown,
): ProjectTimingPreference {
  const v = String(raw);
  return v === 'starting_soon' || v === 'ongoing' || v === 'any' ? v : 'any';
}

export function normalizeTeamSizePreference(raw: unknown): TeamSizePreference {
  const v = String(raw);
  return v === 'small' || v === 'large' || v === 'any' ? v : 'any';
}

export function hasForYouTuneActive(state: VolunteerInterestsState): boolean {
  return (
    state.selectedIds.length > 0 ||
    state.projectTimingPreference !== 'any' ||
    state.teamSizePreference !== 'any'
  );
}

export async function loadVolunteerInterests(): Promise<VolunteerInterestsState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVolunteerInterestsState();
    const parsed = JSON.parse(raw) as Partial<VolunteerInterestsState>;
    const ids = Array.isArray(parsed.selectedIds)
      ? (parsed.selectedIds.filter((id) =>
          ['social', 'environmental', 'cultural'].includes(String(id)),
        ) as VolunteerInterestId[])
      : [];
    return {
      selectedIds: ids,
      projectTimingPreference: normalizeProjectTimingPreference(parsed.projectTimingPreference),
      teamSizePreference: normalizeTeamSizePreference(parsed.teamSizePreference),
      promptCompleted: Boolean(parsed.promptCompleted),
    };
  } catch {
    return defaultVolunteerInterestsState();
  }
}

export async function saveVolunteerInterests(state: VolunteerInterestsState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Сброс для отладки (можно вызвать из dev-меню при необходимости) */
export async function clearVolunteerInterests(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
