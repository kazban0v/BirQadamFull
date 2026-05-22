/**
 * AnimatedSplash.tsx
 *
 * SETUP:
 *   npx expo install expo-haptics
 *   npx expo install @expo-google-fonts/plus-jakarta-sans expo-font
 *
 * NATIVE SPLASH MATCH (app.json):
 *   "splash": { "image": "./assets/splash-screen.png",
 *               "resizeMode": "contain", "backgroundColor": "#ffffff" }
 *   splash-screen.png — белый фон, лист по центру, тот же размер что iconCard.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
  Text,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useTranslation } from '../locales/i18n';

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_DISPLAY_MS = 2800;
const SCREEN_WIDTH = Dimensions.get('window').width;

const LEAF: ImageSourcePropType = require('../../assets/splash-leaf.png');

// ─── Component ────────────────────────────────────────────────────────────────

type AnimatedSplashProps = {
  visible: boolean;
  onFinish?: () => void;
};

export function AnimatedSplash({ visible, onFinish }: AnimatedSplashProps) {
  const { t } = useTranslation();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_800ExtraBold,
  });

  // Min-display gate
  const minTimeElapsed = useRef(false);
  const pendingHide = useRef(false);

  // Animated values
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const leafFloat = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(24)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(16)).current;
  const blobOpacity = useRef(new Animated.Value(0)).current;
  const exitIconTranslate = useRef(new Animated.Value(0)).current;
  const exitIconScale = useRef(new Animated.Value(1)).current;

  // Progress bar — useNativeDriver:false (animates width)
  const progressWidth = useRef(new Animated.Value(0)).current;

  // ── Exit ──────────────────────────────────────────────────────────────────
  const startHide = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    }
    Animated.parallel([
      Animated.timing(exitIconTranslate, {
        toValue: -28,
        duration: 480,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitIconScale, {
        toValue: 0.88,
        duration: 480,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 580,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onFinish?.();
    });
  };

  // ── Entry ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(blobOpacity, { toValue: 1, duration: 700, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, tension: 65, friction: 7, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(380),
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ring1Opacity, { toValue: 0.55, duration: 180, useNativeDriver: true }),
            Animated.timing(ring1Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ring1Scale, { toValue: 2.1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(ring1Opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.delay(300),
        ]),
        { iterations: 3 }
      ),
    ]).start();

    Animated.sequence([
      Animated.delay(680),
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ring2Opacity, { toValue: 0.35, duration: 180, useNativeDriver: true }),
            Animated.timing(ring2Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ring2Scale, { toValue: 2.3, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(ring2Opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
          ]),
          Animated.delay(200),
        ]),
        { iterations: 3 }
      ),
    ]).start();

    Animated.sequence([
      Animated.delay(460),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(titleTranslate, { toValue: 0, duration: 580, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(660),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 460, useNativeDriver: true }),
        Animated.timing(taglineTranslate, { toValue: 0, duration: 540, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(780),
      Animated.loop(
        Animated.sequence([
          Animated.timing(leafFloat, { toValue: -7, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(leafFloat, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ]).start();

    // Progress bar
    Animated.timing(progressWidth, {
      toValue: SCREEN_WIDTH,
      duration: MIN_DISPLAY_MS - 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Minimum display timer
    const timer = setTimeout(() => {
      minTimeElapsed.current = true;
      if (pendingHide.current) startHide();
    }, MIN_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (visible) return;
    if (minTimeElapsed.current) {
      startHide();
    } else {
      pendingHide.current = true;
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.root, { opacity: containerOpacity }]}
    >
      <Animated.View style={[styles.blobTopRight, { opacity: blobOpacity }]} />

      <View style={styles.center}>
        {/* Icon + ripple */}
        <View style={styles.iconArea}>
          <Animated.View style={[styles.rippleRing, {
            opacity: ring1Opacity, transform: [{ scale: ring1Scale }],
          }]} />
          <Animated.View style={[styles.rippleRing, styles.rippleRing2, {
            opacity: ring2Opacity, transform: [{ scale: ring2Scale }],
          }]} />

          {/*
           * iconCard фон WHITE — PNG-фон листа сливается с карточкой.
           * Зелёный характер передаётся через тень и border.
           */}
          <Animated.View
            style={[styles.iconCard, {
              opacity: iconOpacity,
              transform: [
                { scale: Animated.multiply(iconScale, exitIconScale) },
                { translateY: Animated.add(leafFloat, exitIconTranslate) },
              ],
            }]}
          >
            <Image source={LEAF} resizeMode="contain" style={styles.leaf} />
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.View style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleTranslate }],
          alignItems: 'center',
        }}>
          <Text style={[
            styles.titleBir,
            fontsLoaded && { fontFamily: 'PlusJakartaSans_300Light' },
          ]}>Bir</Text>
          <Text style={[
            styles.titleQadam,
            fontsLoaded && { fontFamily: 'PlusJakartaSans_800ExtraBold' },
          ]}>Qadam</Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, {
          opacity: taglineOpacity,
          transform: [{ translateY: taglineTranslate }],
        }]}>
          {t('splash.tagline')}
        </Animated.Text>

        {/* Accent pill */}
        <Animated.View style={[styles.accentPill, { opacity: taglineOpacity }]}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.pillGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 999,
  },
  blobTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(16, 185, 129, 0.07)',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconArea: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 38,
  },
  rippleRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rippleRing2: {
    borderColor: 'rgba(16, 185, 129, 0.18)',
  },
  iconCard: {
    width: 124,
    height: 124,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.12)',
  },
  leaf: {
    width: 88,
    height: 88,
  },
  titleBir: {
    fontSize: 48,
    fontWeight: '300',
    color: '#1A1A2E',
    letterSpacing: 2,
    lineHeight: 52,
  },
  titleQadam: {
    fontSize: 48,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
    lineHeight: 54,
    marginTop: -4,
  },
  tagline: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  accentPill: {
    marginTop: 20,
    width: 40,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  pillGradient: {
    flex: 1,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    width: SCREEN_WIDTH,
    height: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#10B981',
  },
});