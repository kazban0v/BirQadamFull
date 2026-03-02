import type { App } from 'vue';
import { pinia } from './pinia';
import { router } from '@/router';
import { vuetify } from './vuetify';

export function registerPlugins(app: App): void {
  app.use(pinia);
  app.use(router);
  app.use(vuetify);
}

