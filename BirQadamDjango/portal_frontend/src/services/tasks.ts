import { httpClient } from './http';

export interface VolunteerTask {
  id: number;
  text: string;
  project_title: string;
  project_id: number;
  creator_name: string;
  status: string;
  is_assigned: boolean;
  assignment_status: boolean;
  deadline_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  created_at: string;
}

// Кеш для задач, чтобы избежать частых запросов
let tasksCache: { data: VolunteerTask[]; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 5 секунд

export async function fetchVolunteerTasks(forceRefresh = false): Promise<VolunteerTask[]> {
  // Проверяем кеш
  if (!forceRefresh && tasksCache) {
    const now = Date.now();
    if (now - tasksCache.timestamp < CACHE_DURATION) {
      return tasksCache.data;
    }
  }

  try {
    const { data } = await httpClient.get<VolunteerTask[]>('/custom-admin/api/v1/tasks/');
    // Сохраняем в кеш
    tasksCache = { data, timestamp: Date.now() };
    return data;
  } catch (error: any) {
    // Если ошибка 429, используем кеш если есть
    if (error?.response?.status === 429 && tasksCache) {
      console.warn('Rate limit exceeded, using cached data');
      return tasksCache.data;
    }
    throw error;
  }
}

export async function acceptTask(taskId: number) {
  const { data } = await httpClient.post<{ message: string; task_status: string }>(
    `/api/web/volunteer/tasks/${taskId}/accept/`,
  );
  return data;
}

export async function declineTask(taskId: number) {
  const { data } = await httpClient.post<{ message: string; task_status: string }>(
    `/api/web/volunteer/tasks/${taskId}/decline/`,
  );
  return data;
}

export async function completeTask(taskId: number) {
  const { data } = await httpClient.post<{ message: string; task_status: string }>(
    `/api/web/volunteer/tasks/${taskId}/complete/`,
  );
  return data;
}

export async function retryTask(taskId: number) {
  const { data } = await httpClient.post<{ 
    message: string; 
    task_status: string;
    task: {
      id: number;
      status: string;
      status_display: string;
    };
  }>(
    `/api/web/volunteer/tasks/${taskId}/retry/`,
  );
  return data;
}

export async function fetchTaskDetail(taskId: number, forceRefresh = false): Promise<VolunteerTask | null> {
  try {
    // Получаем все задачи и находим нужную (используем кеш если возможно)
    const tasks = await fetchVolunteerTasks(forceRefresh);
    return tasks.find((task) => task.id === taskId) || null;
  } catch (error: any) {
    // Если ошибка 429, пытаемся использовать кеш
    if (error?.response?.status === 429 && tasksCache) {
      console.warn('Rate limit exceeded, using cached data for task detail');
      const task = tasksCache.data.find((t) => t.id === taskId);
      if (task) return task;
    }
    console.error('Failed to fetch task detail:', error);
    return null;
  }
}
