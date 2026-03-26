import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onFilterPress: () => void;
  activeFiltersCount: number;
  onLayout?: (event: any) => void;
  innerRef?: React.RefObject<View | null>;
}

export const SearchBar: React.FC<SearchBarProps> = React.memo(({
  searchQuery,
  onSearchChange,
  onFilterPress,
  activeFiltersCount,
  onLayout,
  innerRef,
}) => {
  return (
    <View 
      ref={innerRef} 
      style={styles.searchContainer}
      onLayout={onLayout}
    >
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск проектов..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
        onPress={onFilterPress}
      >
        <Ionicons name="options-outline" size={20} color={activeFiltersCount > 0 ? '#FFFFFF' : '#1F2937'} />
        {activeFiltersCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
});

SearchBar.displayName = 'SearchBar';

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

