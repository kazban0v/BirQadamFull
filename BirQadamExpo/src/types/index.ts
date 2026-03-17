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
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'under_review' | 'archived' | 'rejected' | 'active';
  assigned_users_count?: number;
  reward_points?: number;
  image?: string;
}

// Типы для уведомлений
export interface Notification {
  id: number;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
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
  username: string;
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
  dashboard_url?: string;
  requires_email_verification?: boolean;
  temporary_password?: string;
}

// Типы для дашборда
export interface DashboardStats {
  total_tasks: number;
  completed_tasks: number;
  total_hours: number;
  total_points: number;
  upcoming_tasks: number;
}

export interface DashboardData {
  user: User;
  stats: DashboardStats;
  upcoming_tasks: Task[];
  recent_achievements: Achievement[];
}
