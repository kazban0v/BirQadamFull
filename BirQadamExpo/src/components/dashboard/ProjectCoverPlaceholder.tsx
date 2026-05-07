import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PLACEHOLDER_BG = '#DCFCE7';
const PLACEHOLDER_ICON = '#16A34A';

const ICON_SIZES = { sm: 28, md: 36, lg: 52 } as const;

type Size = keyof typeof ICON_SIZES;

type Props = {
  style?: StyleProp<ViewStyle>;
  size?: Size;
};

/** Зелёный плейсхолдер с цветком для карточек проекта на главной, если нет обложки */
export const ProjectCoverPlaceholder: React.FC<Props> = ({ style, size = 'md' }) => (
  <View style={[style, styles.root]}>
    <MaterialCommunityIcons name="flower-outline" size={ICON_SIZES[size]} color={PLACEHOLDER_ICON} />
  </View>
);

const styles = StyleSheet.create({
  root: {
    backgroundColor: PLACEHOLDER_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
