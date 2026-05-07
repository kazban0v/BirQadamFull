import { create } from 'zustand';

import type { Task } from '../types';

export type TaskMutationReason =
  | 'accepted'
  | 'declined'
  | 'archived'
  | 'photo_report_submitted';

export interface TaskMutation {
  taskId: number;
  changes: Partial<Task>;
  reason: TaskMutationReason;
  at: number;
}

interface TaskSyncState {
  revision: number;
  lastMutation: TaskMutation | null;
  publishTaskMutation: (mutation: Omit<TaskMutation, 'at'>) => void;
}

export const useTaskSyncStore = create<TaskSyncState>((set) => ({
  revision: 0,
  lastMutation: null,
  publishTaskMutation: (mutation) =>
    set((state) => ({
      revision: state.revision + 1,
      lastMutation: {
        ...mutation,
        at: Date.now(),
      },
    })),
}));
