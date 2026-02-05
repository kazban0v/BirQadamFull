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

export async function fetchVolunteerTasks(): Promise<VolunteerTask[]> {
  const { data } = await httpClient.get<VolunteerTask[]>('/custom-admin/api/v1/tasks/');
  return data;
}

export async function acceptTask(taskId: number) {
  const { data } = await httpClient.post<{ message: string; task_status: string }>(
    `/custom-admin/api/v1/tasks/${taskId}/accept/`,
  );
  return data;
}

export async function declineTask(taskId: number) {
  const { data } = await httpClient.post<{ message: string; task_status: string }>(
    `/custom-admin/api/v1/tasks/${taskId}/decline/`,
  );
  return data;
}

export async function completeTask(taskId: number) {
  const { data } = await httpClient.post<{ message: string; task_status: string }>(
    `/custom-admin/api/v1/tasks/${taskId}/complete/`,
  );
  return data;
}

export async function fetchTaskDetail(taskId: number): Promise<VolunteerTask | null> {
  try {
    // Получаем все задачи и находим нужную
    const tasks = await fetchVolunteerTasks();
    return tasks.find((task) => task.id === taskId) || null;
  } catch (error) {
    console.error('Failed to fetch task detail:', error);
    return null;
  }
}
