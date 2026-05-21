import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { appColors } from '../theme';

type AnimatedSplashProps = {
  visible: boolean;
  onFinish?: () => void;
};

const LEAF: ImageSourcePropType = require('../../assets/splash-leaf.png');

export function AnimatedSplash({ visible, onFinish }: AnimatedSplashProps) {
  // Лист стартует уже в финальной позиции — это та же картинка, что показывает нативный сплэш,
  // поэтому при подмене не должно быть «прыжка». Анимация листа — едва заметное «дыхание».
  const leafScale = useRef(new Animated.Value(1)).current;
  const leafOpacity = useRef(new Animated.Value(1)).current;
  const leafRotate = useRef(new Animated.Value(1)).current;
  const titleTranslate = useRef(new Animated.Value(18)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(leafScale, {
          toValue: 1.06,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(leafScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(ringOpacity, {
            toValue: 1,
            duration: 240,
            useNativeDriver: true,
          }),
          Animated.timing(ringScale, {
            toValue: 1.4,
            duration: 1100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1100,
            delay: 240,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslate, {
            toValue: 0,
            duration: 620,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(560),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [leafScale, ringOpacity, ringScale, titleOpacity, titleTranslate, taglineOpacity]);

  useEffect(() => {
    if (visible) {
      return;
    }

    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onFinish?.();
      }
    });
  }, [visible, containerOpacity, onFinish]);

  const rotate = leafRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '0deg'],
  });

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.root, { opacity: containerOpacity }]}>
      <LinearGradient
        colors={['#FFFFFF', '#ECFDF5', '#D1FAE5']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        <View style={styles.leafWrap}>
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.glowRing,
              styles.glowRingInner,
              {
                opacity: ringOpacity,
                transform: [{ scale: Animated.multiply(ringScale, 0.8) }],
              },
            ]}
          />
          <Animated.Image
            source={LEAF}
            resizeMode="contain"
            style={[
              styles.leaf,
              {
                opacity: leafOpacity,
                transform: [{ scale: leafScale }, { rotate }],
              },
            ]}
          />
        </View>

        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }],
            },
          ]}
        >
          BirQadam
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Бір қадам — үлкен өзгеріс
        </Animated.Text>
      </View>

      <Animated.View style={[styles.footer, { opacity: taglineOpacity }]}>
        <View style={styles.dots}>
          <Dot delay={0} />
          <Dot delay={160} />
          <Dot delay={320} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.6,
            duration: 420,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [delay, scale, opacity]);

  return <Animated.View style={[styles.dot, { opacity, transform: [{ scale }] }]} />;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  leafWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  glowRingInner: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  leaf: {
    width: 160,
    height: 160,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: appColors.primaryDark,
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 12,
    fontSize: 14,
    color: appColors.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
    width: '100%',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: appColors.primary,
  },
});
