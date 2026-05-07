import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

let pendingNavigation:
  | {
      name: string;
      params?: Record<string, unknown>;
    }
  | null = null;

export const navigateFromRoot = (name: string, params?: Record<string, unknown>) => {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
    return;
  }

  pendingNavigation = { name, params };
};

export const flushPendingNavigation = () => {
  if (!navigationRef.isReady() || !pendingNavigation) {
    return;
  }

  navigationRef.dispatch(
    CommonActions.navigate({
      name: pendingNavigation.name,
      params: pendingNavigation.params,
    })
  );
  pendingNavigation = null;
};
