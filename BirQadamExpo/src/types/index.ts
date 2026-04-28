// Типы пользователей
export interface User {
  id: number;
  username: string;
  full_name: string;
  phone_number: string;
  email: string;
  role: 'volunteer' | 'organizer' | 'admin';
  is_organizer?: boolean;
  organizer_status?: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  avatar?: string;
  registration_source?: string;
  organization_name?: string;
  inn?: string;
  bin?: string;
  rating?: number;
  tasks_completed?: number;
  active_tasks?: number;
  total_hours?: number;
  trust_factor?: number;
  average_rating?: number;
  active_projects?: number;
  total_photos?: number;
  achievements_count?: number;
}

// Типы для проектов
export interface Project {
  id: number;
  title: string;
  description: string;
  city: string; // Город проекта
  location?: string; // Альтернативное поле для локации
  volunteer_type: string; // social, environmental, cultural
  start_date: string;
  end_date: string;
  status: 'approved' | 'pending' | 'rejected' | 'active' | 'completed' | 'cancelled'; // Поддержка обоих вариантов
  joined: boolean; // Присоединился ли волонтёр к проекту
  active_members: number; // Количество активных участников
  volunteers_count?: number; // Альтернативное имя
  participants?: Array<{
    id: number;
    name: string;
    avatar_url?: string;
    joined_at?: string;
  }>; // Список участников проекта
  tasks_count: number; // Количество задач в проекте
  organizer_name: string; // Имя организатора
  organizer_id?: number;
  joined_at?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_telegram?: string;
  info_url?: string;
  gis2_url?: string;
  tags?: string[];
  cover_image_url?: string;
  image?: string; // Альтернативное имя для изображения
  created_at?: string;
  organizer?: {
    id: number;
    name: string;
    organization_name?: string;
  };
}

// Типы для задач
export interface Task {
  id: number;
  title: string;
  description: string;
  project_id: number;
  project_title?: string;
  location: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'under_review' | 'archived' | 'rejected' | 'active' | 'failed' | 'closed' | 'revision' | 'expired';
  assigned_users_count?: number;
  reward_points?: number;
  image?: string;
  task_image_url?: string | null;
  project_cover_image_url?: string | null;
  start_time?: string;
  end_time?: string;
  creator_name?: string;
  creator_avatar?: string;
  accepted?: boolean;
  accepted_at?: string;
  photo_uploaded_at?: string;
  photo_moderated_at?: string;
  created_at?: string;
  rating?: number;
  has_photo_report?: boolean;
  completed?: boolean;
  is_expired?: boolean;
  can_upload_photo?: boolean;
  photo_status?: 'pending' | 'approved' | 'rejected' | null;
  rejection_reason?: string | null;
}

// Типы для уведомлений
export interface Notification {
  id: number;
  subject: string;
  message: string;
  created_at: string;
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'failed';
  notification_type?: string;
  activity_id?: number;
  project_id?: number;
  project_title?: string;
  // Backward compatibility
  title?: string;
  is_read?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

// Типы для достижений
export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon?: string;
  earned_at?: string;
  is_earned: boolean;
}

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

export interface VolunteerActivity {
  months: string[];
  series: Record<string, number[]>;
  totals: Record<string, number>;
}

// Типы для фотоотчётов
export interface PhotoReport {
  id: number;
  task_id: number;
  project_id?: number;
  project_title?: string;
  task_text?: string;
  image: string;
  image_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  uploaded_at?: string;
  moderated_at?: string | null;
  created_at?: string;
  rating?: number | null;
  volunteer_comment?: string;
  organizer_comment?: string;
  rejection_reason?: string;
}

export interface CalendarEventParticipant {
  id: number;
  name: string;
  avatar?: string;
}

export interface CalendarEvent {
  id: string;
  source_type: 'project' | 'task' | 'event';
  source_id: number;
  type: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  is_all_day: boolean;
  location?: string | null;
  status?: string | null;
  image?: string | null;
  project_id?: number | null;
  project_title?: string | null;
  project_type?: string | null;
  project_city?: string | null;
  project_address?: string | null;
  project_latitude?: number | null;
  project_longitude?: number | null;
  project_gis2_url?: string | null;
  task_id?: number | null;
  organizer_name?: string | null;
  participants_count: number;
  participants_preview: CalendarEventParticipant[];
}

// Типы для авторизации
export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface VolunteerRegistrationData {
  name: string;
  phone_number: string;
  email: string;
  password: string;
}

export interface OrganizerRegistrationData extends VolunteerRegistrationData {
  organization_name: string;
  inn: string;
  bin: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  access_token?: string;
  refresh_token?: string;
  dashboard_url?: string;
  requires_email_verification?: boolean;
  temporary_password?: string;
}

// Типы для дашборда
export interface DashboardStats {
  // Обязательные поля для фронтенда (StatsGrid)
  total_tasks: number;
  completed_tasks: number;
  total_hours: number;
  total_points: number;
  upcoming_tasks: number;
  active_projects: number;

  // Опциональные поля, которые реально приходят с бэка
  active_tasks?: number;
  pending_photos?: number;
  total_photos?: number;
  unread_notifications?: number;
  achievements_count?: number;
}

export interface DashboardData {
  user: User;
  summary?: DashboardStats; // Теперь summary официально существует и он опционален
  stats?: DashboardStats;   // Оставляем stats на случай старого кэша
  projects: Project[];
  upcoming_tasks: Task[];
  recent_achievements: Achievement[];
  profile: {
    trustFactor: number;
    averageRating: number;
    userName: string;
  };
  unreadNotifications?: number;
}
