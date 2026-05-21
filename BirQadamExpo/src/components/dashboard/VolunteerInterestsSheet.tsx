import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  useWindowDimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { appColors } from '../../theme';
import { appRadius, appSpace } from '../../theme/tokens';
import type {
  ProjectTimingPreference,
  TeamSizePreference,
  VolunteerInterestId,
  VolunteerInterestTunePayload,
} from '../../utils/volunteerInterestsStorage';

const TOTAL_STEPS = 3;

const ORDER: VolunteerInterestId[] = ['social', 'environmental', 'cultural'];

const IDS = new Set<string>(ORDER);

export interface VolunteerInterestsSheetProps {
  visible: boolean;
  onLater: () => void;
  onSave: (payload: VolunteerInterestTunePayload) => void;
  initialTune: VolunteerInterestTunePayload;
  labels: Record<VolunteerInterestId, string>;
  titleDirections: string;
  subtitleDirections: string;
  titleTiming: string;
  subtitleTiming: string;
  labelTimingAny: string;
  labelTimingSoon: string;
  labelTimingOngoing: string;
  titleTeam: string;
  subtitleTeam: string;
  labelTeamAny: string;
  labelTeamSmall: string;
  labelTeamLarge: string;
  wizardProgressLabel: (stepIndex: number, totalSteps: number) => string;
  laterLabel: string;
  nextLabel: string;
  backLabel: string;
  saveLabel: string;
  toggleHint?: string;
  selectOptionHint?: string;
}

const TIMING_ORDER: ProjectTimingPreference[] = ['any', 'starting_soon', 'ongoing'];

const TEAM_ORDER: TeamSizePreference[] = ['any', 'small', 'large'];

export const VolunteerInterestsSheet: React.FC<VolunteerInterestsSheetProps> = ({
  visible,
  onLater,
  onSave,
  initialTune,
  labels,
  titleDirections,
  subtitleDirections,
  titleTiming,
  subtitleTiming,
  labelTimingAny,
  labelTimingSoon,
  labelTimingOngoing,
  titleTeam,
  subtitleTeam,
  labelTeamAny,
  labelTeamSmall,
  labelTeamLarge,
  wizardProgressLabel,
  laterLabel,
  nextLabel,
  backLabel,
  saveLabel,
  toggleHint,
  selectOptionHint,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetSlide = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const [selected, setSelected] = useState<Set<VolunteerInterestId>>(
    () => new Set(initialTune.selectedIds.filter((id) => IDS.has(id))),
  );
  const [timingPref, setTimingPref] = useState<ProjectTimingPreference>(initialTune.projectTimingPreference);
  const [teamPref, setTeamPref] = useState<TeamSizePreference>(initialTune.teamSizePreference);

  const syncFromProps = useCallback(() => {
    setSelected(new Set(initialTune.selectedIds.filter((id) => IDS.has(id))));
    setTimingPref(initialTune.projectTimingPreference);
    setTeamPref(initialTune.teamSizePreference);
  }, [initialTune]);

  useEffect(() => {
    if (visible) {
      syncFromProps();
      setStep(0);
      setShowSuccess(false);
    }
  }, [visible, syncFromProps]);

  useEffect(() => {
    if (!visible) {
      backdropOpacity.setValue(0);
      sheetSlide.setValue(1);
    }
  }, [visible, backdropOpacity, sheetSlide]);

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      sheetSlide.setValue(1);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.spring(sheetSlide, {
          toValue: 0,
          useNativeDriver: true,
          tension: 68,
          friction: 13,
          velocity: 0,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, sheetSlide]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const successOpacity = useRef(new Animated.Value(0)).current;

  const runCloseAnimations = useCallback(
    (after: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
        Animated.timing(sheetSlide, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.cubic),
        }),
      ]).start(({ finished }) => {
        if (finished) after();
      });
    },
    [backdropOpacity, sheetSlide],
  );

  const toggleDirection = useCallback((id: VolunteerInterestId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBackdrop = () => {
    runCloseAnimations(onLater);
  };

  const handleLaterPress = () => {
    runCloseAnimations(onLater);
  };

  const buildPayload = useCallback(
    (): VolunteerInterestTunePayload => ({
      selectedIds: Array.from(selected).filter((id) => IDS.has(id)) as VolunteerInterestId[],
      projectTimingPreference: timingPref,
      teamSizePreference: teamPref,
    }),
    [selected, timingPref, teamPref],
  );

  const persistAndClose = () => {
    runCloseAnimations(() => {
      onSave(buildPayload());
    });
  };

  const runSuccessState = () => {
    setShowSuccess(true);
    Animated.timing(successOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();

    setTimeout(() => {
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setShowSuccess(false);
      });
      persistAndClose();
    }, 2000);
  };

  const handlePrimary = () => {
    if (step === 0) {
      if (selected.size === 0) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2 && selected.size === 0) return;
    runSuccessState();
  };

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  const primaryDisabled = step === 0 && selected.size === 0;

  const showBack = step > 0;
  const isLastStep = step === TOTAL_STEPS - 1;

  const titleForStep = step === 0 ? titleDirections : step === 1 ? titleTiming : titleTeam;
  const subtitleForStep = step === 0 ? subtitleDirections : step === 1 ? subtitleTiming : subtitleTeam;

  const wizardIcon = step === 0 ? 'sparkles' : step === 1 ? 'calendar-outline' : 'people-outline';

  const timingLabel = (id: ProjectTimingPreference) =>
    ({
      any: labelTimingAny,
      starting_soon: labelTimingSoon,
      ongoing: labelTimingOngoing,
    }[id]);

  const teamLabel = (id: TeamSizePreference) =>
    ({
      any: labelTeamAny,
      small: labelTeamSmall,
      large: labelTeamLarge,
    }[id]);

  const maxSheetWidth = useMemo(() => Math.min(windowWidth - 24, 480), [windowWidth]);
  const sheetTranslate = sheetSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 520],
  });

  const progressLabel = wizardProgressLabel(step, TOTAL_STEPS);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleLaterPress}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdrop}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.backdropSolid]} />
            )}
          </Animated.View>
        </Pressable>

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.sheetOuter,
            {
              paddingBottom: Math.max(insets.bottom, appSpace.md),
              transform: [{ translateY: sheetTranslate }],
            },
          ]}
        >
          <View style={[styles.sheetCard, { maxWidth: maxSheetWidth, width: '100%', alignSelf: 'center' }]}>
            <LinearGradient
              colors={[appColors.primarySurfaceStrong, appColors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetGradientTint}
            />
            <View style={styles.handleBar} />

            <View style={styles.progressRow}>
              <Text style={styles.progressCaps}>{progressLabel}</Text>
              <View style={styles.dotsWrap}>
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <View key={String(i)} style={[styles.dot, i === step ? styles.dotOn : styles.dotOff]} />
                ))}
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScrollInner}
            >
              <View style={styles.heroIconWrap}>
                <LinearGradient
                  colors={[appColors.primary, appColors.primaryDark]}
                  style={styles.heroIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={wizardIcon} size={26} color={appColors.white} />
                </LinearGradient>
              </View>

              <Text style={styles.title}>{titleForStep}</Text>
              <Text style={styles.subtitle}>{subtitleForStep}</Text>

              {step === 0 && (
                <View style={styles.chipsWrap}>
                  {ORDER.map((id) => {
                    const active = selected.has(id);
                    return (
                      <TouchableOpacity
                        key={id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${labels[id]}. ${toggleHint ?? ''}`}
                        onPress={() => toggleDirection(id)}
                        activeOpacity={0.88}
                        style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                        hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                      >
                        <Ionicons
                          name={active ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={active ? appColors.primaryDark : appColors.textMuted}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={3}>
                          {labels[id]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {step === 1 && (
                <View style={styles.chipsWrap}>
                  {TIMING_ORDER.map((id) => (
                    <TouchableOpacity
                      key={id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: timingPref === id }}
                      accessibilityLabel={`${timingLabel(id)} ${selectOptionHint ?? ''}`}
                      onPress={() => setTimingPref(id)}
                      style={[styles.chipRadio, timingPref === id ? styles.chipActive : styles.chipIdle]}
                      activeOpacity={0.88}
                    >
                      <Ionicons
                        name={timingPref === id ? 'radio-button-on' : 'radio-button-off'}
                        size={21}
                        color={timingPref === id ? appColors.primaryDark : appColors.textMuted}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.chipLabel, timingPref === id && styles.chipLabelActive]} numberOfLines={3}>
                        {timingLabel(id)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {step === 2 && (
                <View style={styles.chipsWrap}>
                  {TEAM_ORDER.map((id) => (
                    <TouchableOpacity
                      key={id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: teamPref === id }}
                      accessibilityLabel={`${teamLabel(id)} ${selectOptionHint ?? ''}`}
                      onPress={() => setTeamPref(id)}
                      style={[styles.chipRadio, teamPref === id ? styles.chipActive : styles.chipIdle]}
                      activeOpacity={0.88}
                    >
                      <Ionicons
                        name={teamPref === id ? 'radio-button-on' : 'radio-button-off'}
                        size={21}
                        color={teamPref === id ? appColors.primaryDark : appColors.textMuted}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.chipLabel, teamPref === id && styles.chipLabelActive]} numberOfLines={4}>
                        {teamLabel(id)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              {!showBack ? (
                <>
                  <TouchableOpacity
                    style={styles.btnSecondary}
                    onPress={handleLaterPress}
                    accessibilityRole="button"
                    accessibilityLabel={laterLabel}
                  >
                    <Text style={styles.btnSecondaryText}>{laterLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimaryWide, primaryDisabled && styles.btnPrimaryDisabled]}
                    onPress={handlePrimary}
                    disabled={primaryDisabled}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: primaryDisabled }}
                  >
                    <LinearGradient
                      colors={
                        primaryDisabled ? [appColors.borderStrong, appColors.border] : [appColors.primary, appColors.primaryDark]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnPrimaryFill}
                    >
                      <Text style={styles.btnPrimaryText}>{nextLabel}</Text>
                      {!isLastStep && (
                        <Ionicons name="arrow-forward" size={18} color={appColors.white} style={{ marginLeft: 8 }} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.btnSecondary} onPress={handleBack} accessibilityRole="button">
                    <Text style={styles.btnSecondaryText}>{backLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimaryWide, primaryDisabled && styles.btnPrimaryDisabled]}
                    onPress={handlePrimary}
                    disabled={primaryDisabled}
                  >
                    <LinearGradient
                      colors={
                        primaryDisabled ? [appColors.borderStrong, appColors.border] : [appColors.primary, appColors.primaryDark]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnPrimaryFill}
                    >
                      <Text style={styles.btnPrimaryText}>{isLastStep ? saveLabel : nextLabel}</Text>
                      {!isLastStep && (
                        <Ionicons name="arrow-forward" size={18} color={appColors.white} style={{ marginLeft: 8 }} />
                      )}
                      {isLastStep && (
                        <Ionicons name="checkmark" size={20} color={appColors.white} style={{ marginLeft: 8 }} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Full-screen success overlay */}
        {showSuccess && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { zIndex: 100, opacity: successOpacity, justifyContent: 'center', alignItems: 'center' }
            ]}
            pointerEvents="auto"
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.92)' }]} />
            )}
            <View style={{ alignItems: 'center', padding: 32, paddingBottom: 64 }}>
              <Ionicons name="checkmark-circle" size={88} color={appColors.primary} />
              <Text style={{ fontSize: 28, fontWeight: '800', color: appColors.text, marginTop: 24, textAlign: 'center' }}>
                Спасибо!
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '500', color: appColors.textSecondary, marginTop: 12, textAlign: 'center' }}>
                Мы подобрали проекты для вас
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropSolid: {
    backgroundColor: 'rgba(15,23,42,0.52)',
  },
  sheetOuter: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: appSpace.md,
    paddingTop: appSpace.sm,
  },
  sheetCard: {
    borderRadius: appRadius.xl,
    backgroundColor: appColors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 0,
    borderColor: appColors.border,
    marginBottom: 4,
    maxHeight: '88%',
  },
  sheetGradientTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: appColors.borderStrong,
    marginTop: appSpace.sm,
    marginBottom: appSpace.sm,
    opacity: 0.85,
  },
  progressRow: {
    paddingHorizontal: appSpace.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: appSpace.sm,
    flexWrap: 'wrap',
  },
  progressCaps: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: appColors.textSoft,
    flexShrink: 1,
  },
  dotsWrap: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: appColors.primary,
  },
  dotOn: {
    width: 26,
    borderRadius: 8,
    backgroundColor: appColors.primaryDark,
    opacity: 1,
  },
  dotOff: {
    opacity: 0.32,
    backgroundColor: appColors.primary,
  },
  sheetScrollInner: {
    paddingHorizontal: appSpace.lg,
    paddingBottom: appSpace.sm,
  },
  heroIconWrap: {
    alignItems: 'center',
    marginBottom: appSpace.md,
  },
  heroIconGradient: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.35,
    color: appColors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: appColors.textSecondary,
    textAlign: 'center',
    marginBottom: appSpace.lg,
    paddingHorizontal: appSpace.sm,
  },
  chipsWrap: {
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: appRadius.lg,
    borderWidth: 1.5,
    minHeight: 52,
    backgroundColor: appColors.surface,
  },
  chipRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: appRadius.lg,
    borderWidth: 1.5,
    minHeight: 52,
    backgroundColor: appColors.surface,
  },
  chipIdle: {
    borderColor: appColors.border,
  },
  chipActive: {
    borderColor: appColors.primary,
    backgroundColor: appColors.primarySurface,
  },
  chipLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: appColors.text,
  },
  chipLabelActive: {
    color: appColors.primaryDark,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: appSpace.md,
    paddingHorizontal: 2,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: appColors.textSoft,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: appSpace.lg,
    paddingTop: appSpace.sm,
    paddingBottom: appSpace.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.borderSoft,
    backgroundColor: appColors.surface,
  },
  btnSecondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: appRadius.md,
    borderWidth: 1.5,
    borderColor: appColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surfaceSoft,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.textSecondary,
  },
  btnPrimaryWide: {
    flex: 1.2,
    minHeight: 50,
    borderRadius: appRadius.md,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  btnPrimaryDisabled: {
    opacity: 0.65,
  },
  btnPrimaryFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: 50,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: appColors.white,
  },
});
