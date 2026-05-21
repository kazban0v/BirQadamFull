import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../../theme';

const ICON_SIZES = { sm: 30, md: 40, lg: 56 } as const;

type Size = keyof typeof ICON_SIZES;

type Props = {
  style?: StyleProp<ViewStyle>;
  size?: Size;
};

/** Плейсхолдер без баннера: мятный фон + один зелёный значок листа (везде одинаково) */
export const ProjectCoverPlaceholder: React.FC<Props> = ({ style, size = 'md' }) => (
  <View style={[styles.root, style]}>
    <Ionicons name="leaf" size={ICON_SIZES[size]} color={appColors.primary} />
  </View>
);

const styles = StyleSheet.create({
  root: {
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
