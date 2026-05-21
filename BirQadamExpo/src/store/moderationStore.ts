import { create } from 'zustand';
import { moderationAPI } from '../services/api';

interface ModerationState {
  blockedUserIds: number[];
  isLoading: boolean;
  fetchBlockedUsers: () => Promise<void>;
  blockUser: (userId: number) => Promise<void>;
  unblockUser: (blockId: number, userId: number) => Promise<void>;
}

export const useModerationStore = create<ModerationState>((set, get) => ({
  blockedUserIds: [],
  isLoading: false,

  fetchBlockedUsers: async () => {
    set({ isLoading: true });
    try {
      const response = await moderationAPI.getBlockedUsers();
      const ids = response.data.map((b: any) => b.blocked_user_id);
      set({ blockedUserIds: ids, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch blocked users', error);
      set({ isLoading: false });
    }
  },

  blockUser: async (userId: number) => {
    try {
      await moderationAPI.blockUser(userId);
      set((state) => ({
        blockedUserIds: [...state.blockedUserIds, userId],
      }));
    } catch (error) {
      console.error('Failed to block user', error);
      throw error;
    }
  },

  unblockUser: async (blockId: number, userId: number) => {
    try {
      await moderationAPI.unblockUser(blockId);
      set((state) => ({
        blockedUserIds: state.blockedUserIds.filter((id) => id !== userId),
      }));
    } catch (error) {
      console.error('Failed to unblock user', error);
      throw error;
    }
  },
}));
