import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Dimensions,
  LayoutRectangle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  ref: React.RefObject<View | null>;
  position: 'top' | 'bottom';
}

interface TutorialOverlayProps {
  visible: boolean;
  currentStep: number;
  steps: TutorialStep[];
  highlightedElement: LayoutRectangle | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
  isProcessingNext?: boolean;
  canGoBack?: boolean;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = React.memo(({
  visible,
  currentStep,
  steps,
  highlightedElement,
  onNext,
  onPrev,
  onSkip,
  onFinish,
  isProcessingNext = false,
  canGoBack = true,
}) => {
  if (!visible) {
    return null;
  }

  // Проверяем валидность шага
  if (currentStep < 0 || currentStep >= steps.length) {
    if (__DEV__) {
      console.warn(`⚠️ Invalid tutorial step: ${currentStep}, max: ${steps.length - 1}`);
    }
    return null;
  }

  const currentStepData = steps[currentStep];

  if (!currentStepData) {
    if (__DEV__) {
      console.warn(`⚠️ Current step is null for step ${currentStep}`);
    }
    return null;
  }

  // Если элемент еще не измерен, используем дефолтные координаты для показа подсказки
  const defaultCoords = {
    x: 20,
    y: currentStep === 0 ? 50 : currentStep === 1 ? 130 : currentStep === 2 ? 300 : currentStep === 3 ? 450 : 50,
    width: 350,
    height: currentStep === 0 ? 100 : currentStep === 1 ? 150 : currentStep === 2 ? 100 : currentStep === 3 ? 100 : 100,
  };

  const elementCoords = highlightedElement || defaultCoords;
  const { x, y, width, height } = elementCoords;
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isTop = false; // Все подсказки всегда снизу

  // Вычисляем позицию подсказки
  const tooltipHeight = 200; // Примерная высота подсказки с кнопками
  const tooltipWidth = 300;

  let tooltipY: number;
  let tooltipX: number;

  if (isTop) {
    // Подсказка над элементом (не используется, но оставлено для совместимости)
    tooltipY = Math.max(20, y - tooltipHeight - 10);
    tooltipX = Math.max(20, Math.min(x - 20, screenWidth - tooltipWidth - 20));
  } else {
    // Подсказка под элементом
    tooltipY = Math.min(screenHeight - tooltipHeight - 20, y + height + 10);
    tooltipX = Math.max(20, Math.min(x - 20, screenWidth - tooltipWidth - 20));
  }

  if (__DEV__) {
    console.log(`🎯 Rendering tooltip for step ${currentStep + 1}:`, {
      element: { x, y, width, height },
      tooltipY,
      tooltipX,
      isTop,
      screenHeight,
    });
  }

  const isLastStep = currentStep === steps.length - 1;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        // На Android кнопка "Назад" вызывает onRequestClose
        // Но мы не хотим закрывать туториал случайно
        if (__DEV__) {
          console.log('📱 Modal onRequestClose called (Android back button) - ignoring');
        }
      }}
      statusBarTranslucent={true}
    >
      <View style={styles.tutorialOverlay}>
        {/* Затемнение */}
        <View style={styles.tutorialBackdrop} pointerEvents="none" />

        {/* Подсветка элемента */}
        <Animated.View
          style={[
            styles.tutorialHighlight,
            {
              top: y - 4,
              left: x - 4,
              width: width + 8,
              height: height + 8,
            },
          ]}
          pointerEvents="none"
        />

        {/* Всплывающая подсказка */}
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.tutorialTooltip,
            {
              top: tooltipY,
              left: tooltipX,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Стрелка */}
          <View
            style={[
              styles.tutorialArrow,
              isTop ? styles.tutorialArrowBottom : styles.tutorialArrowTop,
              {
                left: Math.min(Math.max(x + width / 2 - 10, 20), screenWidth - 60),
              },
            ]}
          />

          {/* Контент подсказки */}
          <View style={styles.tutorialTooltipContent}>
            <View style={styles.tutorialTooltipHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tutorialTooltipTitle}>{currentStepData.title}</Text>
                <Text style={styles.tutorialStepIndicator}>
                  {currentStep + 1} / {steps.length}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onSkip}
                style={styles.tutorialCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.tutorialTooltipDescription}>
              {currentStepData.description}
            </Text>

            {/* Кнопки навигации */}
            <View style={styles.tutorialButtons}>
              {canGoBack && (
                <TouchableOpacity
                  style={[styles.tutorialButton, styles.tutorialButtonSecondary]}
                  onPress={onPrev}
                  disabled={currentStep === 0}
                  activeOpacity={currentStep === 0 ? 0.5 : 0.7}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={currentStep === 0 ? '#9CA3AF' : '#10B981'}
                  />
                  <Text
                    style={[
                      styles.tutorialButtonSecondaryText,
                      currentStep === 0 && styles.tutorialButtonDisabledText,
                    ]}
                  >
                    Назад
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.tutorialButton, styles.tutorialButtonPrimary]}
                onPress={isLastStep ? onFinish : onNext}
                disabled={isProcessingNext}
                activeOpacity={0.7}
              >
                {isProcessingNext ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.tutorialButtonPrimaryText}>
                      {isLastStep ? 'Завершить' : 'Далее'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

TutorialOverlay.displayName = 'TutorialOverlay';

const styles = StyleSheet.create({
  tutorialOverlay: {
    flex: 1,
    position: 'relative',
  },
  tutorialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  tutorialHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#10B981',
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 10,
  },
  tutorialTooltip: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    minWidth: 280,
    maxWidth: 320,
  },
  tutorialArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
  },
  tutorialArrowTop: {
    top: -10,
    borderBottomWidth: 10,
    borderBottomColor: '#FFFFFF',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tutorialArrowBottom: {
    bottom: -10,
    borderTopWidth: 10,
    borderTopColor: '#FFFFFF',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tutorialTooltipContent: {
    gap: 12,
  },
  tutorialTooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  tutorialTooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  tutorialStepIndicator: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tutorialCloseButton: {
    padding: 4,
  },
  tutorialTooltipDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  tutorialButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  tutorialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  tutorialButtonPrimary: {
    backgroundColor: '#10B981',
  },
  tutorialButtonSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tutorialButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tutorialButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  tutorialButtonDisabledText: {
    color: '#9CA3AF',
  },
});

