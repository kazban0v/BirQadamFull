import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  translateY: Animated.Value;
  opacity: Animated.Value;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; bg: string; iconColor: string }> = {
  success: { icon: 'checkmark-circle', bg: '#1C3A2F', iconColor: '#34D399' },
  error: { icon: 'close-circle', bg: '#3A1C1C', iconColor: '#F87171' },
  info: { icon: 'information-circle', bg: '#1C2A3A', iconColor: '#60A5FA' },
  warning: { icon: 'warning', bg: '#3A2E1C', iconColor: '#FCD34D' },
};

// ─── Single Toast component ───────────────────────────────────────────────────

const ToastItemView: React.FC<{
  item: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const config = TOAST_CONFIG[item.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.bg, opacity: item.opacity, transform: [{ translateY: item.translateY }] },
      ]}
    >
      <Ionicons name={config.icon} size={20} color={config.iconColor} style={styles.icon} />
      <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
      <TouchableOpacity onPress={() => onDismiss(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];

    setToasts(prev => {
      const item = prev.find(t => t.id === id);
      if (!item) return prev;

      Animated.parallel([
        Animated.timing(item.translateY, { toValue: 80, duration: 250, useNativeDriver: true }),
        Animated.timing(item.opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        setToasts(current => current.filter(t => t.id !== id));
      });

      return prev;
    });
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    const translateY = new Animated.Value(80);
    const opacity = new Animated.Value(0);

    const item: ToastItem = { id, message, type, translateY, opacity };

    setToasts(prev => {
      const next = [...prev, item];
      return next.slice(-3);
    });

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timersRef.current[id] = setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const success = useCallback((msg: string, dur?: number) => show(msg, 'success', dur), [show]);
  const error = useCallback((msg: string, dur?: number) => show(msg, 'error', dur), [show]);
  const info = useCallback((msg: string, dur?: number) => show(msg, 'info', dur), [show]);
  const warning = useCallback((msg: string, dur?: number) => show(msg, 'warning', dur), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning }}>
      {children}
      <View
        style={[styles.container, { bottom: Math.max(insets.bottom, 16) + 80 }]}
        pointerEvents="box-none"
      >
        {toasts.map(item => (
          <ToastItemView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
    elevation: 99,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  icon: {
    marginRight: 10,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: appColors.white,
    lineHeight: 20,
  },
});
