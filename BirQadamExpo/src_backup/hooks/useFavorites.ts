import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useFavorites = () => {
  const [favoriteProjects, setFavoriteProjects] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('favoriteProjects');
      if (stored) {
        setFavoriteProjects(JSON.parse(stored));
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error loading favorites:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFavorites = useCallback(async (favorites: number[]) => {
    try {
      await AsyncStorage.setItem('favoriteProjects', JSON.stringify(favorites));
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error saving favorites:', error);
      }
    }
  }, []);

  const toggleFavorite = useCallback(async (projectId: number) => {
    const newFavorites = favoriteProjects.includes(projectId)
      ? favoriteProjects.filter(id => id !== projectId)
      : [...favoriteProjects, projectId];
    
    setFavoriteProjects(newFavorites);
    await saveFavorites(newFavorites);
  }, [favoriteProjects, saveFavorites]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    favoriteProjects,
    loading,
    toggleFavorite,
    loadFavorites,
  };
};

