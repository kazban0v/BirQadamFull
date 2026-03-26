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
  status: 'pending' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'under_review' | 'archived' | 'rejected' | 'active' | 'failed' | 'closed';
  assigned_users_count?: number;
  reward_points?: number;
  image?: string;
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

// Типы для фотоотчётов
export interface PhotoReport {
  id: number;
  task_id: number;
  image: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason?: string;
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
