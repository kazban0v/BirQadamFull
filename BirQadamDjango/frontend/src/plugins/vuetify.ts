import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify, type ThemeDefinition } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import { md3 } from 'vuetify/blueprints';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const birqadamLight: ThemeDefinition = {
  dark: false,
  colors: {
    primary: '#8BC34A', // BirQadam Primary (Светло-зеленый)
    secondary: '#e3794d', // BirQadam Accent (Оранжево-персиковый)
    success: '#4CAF50', // Success Green
    warning: '#FFC107',
    error: '#F44336',
    info: '#8BC34A', // BirQadam Primary (используем primary для info тоже)
    background: '#f8ecc4', // BirQadam Background (фон задний)
    surface: '#FFFFFF', // Чисто белый
  },
};

export const vuetify = createVuetify({
  blueprint: md3,
  components,
  directives,
  theme: {
    defaultTheme: 'birqadamLight',
    themes: {
      birqadamLight,
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
});

