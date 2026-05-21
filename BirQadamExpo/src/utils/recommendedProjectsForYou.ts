import type { Project } from '../types';
import type {
  ProjectTimingPreference,
  TeamSizePreference,
  VolunteerInterestId,
} from './volunteerInterestsStorage';

const MAX_ITEMS = 6;

const MS_DAY = 86400000;

function parseProjTime(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Дополнительное ранжирование по времени участия и размеру команды (локальные prefs). */
function boostProjectForPreferences(
  p: Project,
  timing: ProjectTimingPreference,
  team: TeamSizePreference,
): number {
  const members = typeof p.active_members === 'number' ? p.active_members : 0;
  let add = Math.min(members / 140, 1.75);

  if (timing !== 'any') {
    const now = Date.now();
    const start = parseProjTime(p.start_date);
    const end = parseProjTime(p.end_date);

    let inWindow = false;
    if (start != null && end != null && start <= now && now <= end) inWindow = true;
    else if (start != null && end != null && end < now) inWindow = false;
    else if (start != null && end == null && start <= now) inWindow = true;
    else if (start != null && end != null && start > now && end >= start) inWindow = false; // будущее

    if (timing === 'ongoing') {
      if (inWindow) add += 14;
      else if (start != null && start <= now && (end == null || end >= now)) add += 10;
      else add -= 4;
    } else if (timing === 'starting_soon') {
      if (start != null && start > now && start <= now + MS_DAY * 120) add += 12;
      else if (start != null && start <= now && (end ?? now + 1) >= now && now - start < MS_DAY * 50)
        add += 10;
      else add += inWindow ? 4 : -2;
    }
  }

  if (team === 'small') {
    add += members <= 15 ? 5 : members <= 32 ? 2 : members >= 85 ? -2 : 0;
  } else if (team === 'large') {
    add += members >= 42 ? 5 : members >= 22 ? 2 : members <= 6 ? -1 : 0;
  }

  return add;
}

function compareForPreferences(
  a: Project,
  b: Project,
  timing: ProjectTimingPreference,
  team: TeamSizePreference,
): number {
  const da = boostProjectForPreferences(a, timing, team);
  const db = boostProjectForPreferences(b, timing, team);
  if (db !== da) return db - da;
  return sortByMembersDesc(a, b);
}

function uniqById(items: Project[]): Project[] {
  const seen = new Set<number>();
  const out: Project[] = [];
  for (const p of items) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function sortByMembersDesc(a: Project, b: Project): number {
  return (b.active_members || 0) - (a.active_members || 0);
}

function fillFromAlternate(
  current: Project[],
  alternatePool: Project[],
  target: number,
): Project[] {
  if (current.length >= target) return current.slice(0, target);
  const ids = new Set(current.map((p) => p.id));
  const extra = alternatePool.filter((p) => !ids.has(p.id)).sort(sortByMembersDesc);
  return uniqById([...current, ...extra]).slice(0, target);
}

function sortPreferredPool(
  list: Project[],
  timing: ProjectTimingPreference,
  team: TeamSizePreference,
): Project[] {
  if (timing === 'any' && team === 'any') return [...list].sort(sortByMembersDesc);
  return [...list].sort((x, y) => compareForPreferences(x, y, timing, team));
}

/** Подбор «для вас»: локальные направления и предпочтения по времени/размеру команды при необходимости. */
export function computeRecommendedProjectsForYou(params: {
  projects: Project[];
  filteredProjects: Project[];
  favoriteProjectIds: number[];
  localInterests: VolunteerInterestId[];
  projectTimingPreference: ProjectTimingPreference;
  teamSizePreference: TeamSizePreference;
}): Project[] {
  const {
    projects,
    filteredProjects,
    favoriteProjectIds,
    localInterests,
    projectTimingPreference,
    teamSizePreference,
  } = params;

  const poolFiltered = filteredProjects.filter((p) => !p.joined);
  const poolAll = projects.filter((p) => !p.joined);

  if (localInterests.length > 0 && poolFiltered.length > 0) {
    const preferredRaw = poolFiltered.filter((p) =>
      localInterests.includes(p.volunteer_type as VolunteerInterestId),
    );
    const restFiltered = poolFiltered.filter(
      (p) => !localInterests.includes(p.volunteer_type as VolunteerInterestId),
    );
    const preferred = sortPreferredPool(preferredRaw, projectTimingPreference, teamSizePreference);
    const restSorted = sortPreferredPool(restFiltered, projectTimingPreference, teamSizePreference);
    const merged = fillFromAlternate(uniqById([...preferred, ...restSorted]), poolAll, MAX_ITEMS);
    return merged;
  }

  const joinedProjects = projects.filter((p) => p.joined);

  if (joinedProjects.length === 0) {
    const sorted = sortPreferredPool(
      [...poolFiltered],
      projectTimingPreference,
      teamSizePreference,
    );
    return fillFromAlternate(sorted, poolAll, MAX_ITEMS).slice(0, MAX_ITEMS);
  }

  const preferredTypes: string[] = [];
  const preferredTags: string[] = [];
  const preferredCities: string[] = [];

  joinedProjects.forEach((project) => {
    if (project.volunteer_type && !preferredTypes.includes(project.volunteer_type)) {
      preferredTypes.push(project.volunteer_type);
    }
    if (project.tags && Array.isArray(project.tags)) {
      project.tags.forEach((tag) => {
        if (!preferredTags.includes(tag)) preferredTags.push(tag);
      });
    }
    if (project.city && !preferredCities.includes(project.city)) preferredCities.push(project.city);
  });

  projects
    .filter((p) => favoriteProjectIds.includes(p.id))
    .forEach((project) => {
      if (project.volunteer_type && !preferredTypes.includes(project.volunteer_type)) {
        preferredTypes.push(project.volunteer_type);
      }
      if (project.tags && Array.isArray(project.tags)) {
        project.tags.forEach((tag) => {
          if (!preferredTags.includes(tag)) preferredTags.push(tag);
        });
      }
    });

  const scored = poolAll
    .map((project) => {
      let score = 0;
      if (project.volunteer_type && preferredTypes.includes(project.volunteer_type)) score += 3;
      if (project.tags && Array.isArray(project.tags)) {
        project.tags.forEach((tag) => {
          if (preferredTags.includes(tag)) score += 2;
        });
      }
      if (project.city && preferredCities.includes(project.city)) score += 1;
      score += boostProjectForPreferences(project, projectTimingPreference, teamSizePreference);
      score += (project.active_members || 0) / 28;
      return { project, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || sortByMembersDesc(a.project, b.project))
    .map((item) => item.project);

  let ranked = scored.slice(0, MAX_ITEMS);
  if (ranked.length < MAX_ITEMS) {
    ranked = fillFromAlternate(
      ranked,
      poolAll.filter((p) => !ranked.some((rp) => rp.id === p.id)),
      MAX_ITEMS,
    );
  }
  return ranked.slice(0, MAX_ITEMS);
}
