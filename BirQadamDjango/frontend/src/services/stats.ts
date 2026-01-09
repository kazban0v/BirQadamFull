import { httpClient } from './http';

export interface VolunteerAchievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  required_rating: number;
  xp: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface VolunteerStats {
  rating: number;
  level: number;
  previous_level_rating: number;
  next_level_rating: number;
  progress: number;
  unlocked_achievements: number;
  total_achievements: number;
  achievements: VolunteerAchievement[];
}

export async function fetchVolunteerStats(): Promise<VolunteerStats> {
  const { data } = await httpClient.get<VolunteerStats>('/api/web/volunteer/stats/');
  return data;
}

export interface VolunteerActivity {
  months: string[];
  series: Record<string, number[]>;
  totals: Record<string, number>;
}

export async function fetchVolunteerActivity(months = 6): Promise<VolunteerActivity> {
  const { data } = await httpClient.get<VolunteerActivity>('/api/web/volunteer/activity/', {
    params: { months },
  });
  return data;
}

