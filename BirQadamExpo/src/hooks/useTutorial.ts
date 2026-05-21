import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LayoutRectangle, View } from 'react-native';
import type { TutorialStep } from '../components/dashboard/TutorialOverlay';

interface UseTutorialOptions {
  storageKey?: string;
  autoStart?: boolean;
  startDelay?: number;
}

export const useTutorial = (
  steps: TutorialStep[],
  options: UseTutorialOptions = {}
) => {
  const {
    storageKey = 'dashboardTutorialCompleted',
    autoStart = true,
    startDelay = 1500,
  } = options;

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<LayoutRectangle | null>(null);
  const [isProcessingNext, setIsProcessingNext] = useState(false);
  
  const tutorialCheckedRef = useRef(false);
  const nextTutorialStepRef = useRef(false);

  // Проверка статуса туториала
  const checkTutorialStatus = useCallback(async () => {
    if (tutorialCheckedRef.current) {
      if (__DEV__) {
        console.log('⚠️ Tutorial already checked, skipping...');
      }
      return;
    }

    if (showTutorial) {
      if (__DEV__) {
        console.log('⚠️ Tutorial already showing, skipping check...');
      }
      return;
    }

    try {
      tutorialCheckedRef.current = true;
      const tutorialCompleted = await AsyncStorage.getItem(storageKey);

      if (__DEV__) {
        console.log('📋 Tutorial status from storage:', tutorialCompleted);
      }

      if (!tutorialCompleted && autoStart) {
        if (__DEV__) {
          console.log(`🎓 Tutorial not completed, will start in ${startDelay}ms...`);
        }
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (__DEV__) {
              console.log('🎓 Starting tutorial now...');
            }
            setShowTutorial(true);
            setTutorialStep(0);
          }, startDelay);
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error checking tutorial status:', error);
      }
      tutorialCheckedRef.current = false;
    }
  }, [storageKey, autoStart, startDelay, showTutorial]);

  // Обработчик измерения элемента
  const handleElementLayout = useCallback((elementId: string, event: any) => {
    if (!showTutorial) return;

    const { x, y, width, height } = event.nativeEvent.layout;
    const currentStepData = steps[tutorialStep];

    if (currentStepData && currentStepData.id === elementId) {
      if (currentStepData.ref.current) {
        currentStepData.ref.current.measureInWindow((winX, winY, winWidth, winHeight) => {
          if (winX >= 0 && winY >= 0 && winWidth > 0 && winHeight > 0) {
            if (__DEV__) {
              console.log(`✅ Element ${elementId} measured:`, {
                x: winX,
                y: winY,
                width: winWidth,
                height: winHeight,
              });
            }
            setHighlightedElement({ x: winX, y: winY, width: winWidth, height: winHeight });
          }
        });
      }
    }
  }, [showTutorial, tutorialStep, steps]);

  // Измерение позиции элемента (fallback)
  const measureElement = useCallback((ref: React.RefObject<View | null>) => {
    try {
      if (!ref.current) {
        if (__DEV__) {
          console.warn('⚠️ Ref is null, retrying in 200ms...');
        }
        setTimeout(() => {
          if (ref.current) {
            measureElement(ref);
          } else {
            if (__DEV__) {
              console.warn('⚠️ Ref still null after retry, using defaults');
            }
            setHighlightedElement({ x: 20, y: 100, width: 300, height: 100 });
          }
        }, 200);
        return;
      }

      requestAnimationFrame(() => {
        if (!ref.current) {
          if (__DEV__) {
            console.warn('⚠️ Ref became null in requestAnimationFrame');
          }
          setHighlightedElement({ x: 20, y: 100, width: 300, height: 100 });
          return;
        }

        ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (x >= 0 && y >= 0 && width > 0 && height > 0) {
            if (__DEV__) {
              console.log('✅ Element measured successfully:', { x, y, width, height });
            }
            setHighlightedElement({ x, y, width, height });
          } else {
            if (__DEV__) {
              console.warn('⚠️ Invalid coordinates, using defaults:', { x, y, width, height });
            }
            setHighlightedElement({ x: 20, y: 100, width: 300, height: 100 });
          }
        });
      });
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error measuring element:', error);
      }
      setHighlightedElement({ x: 20, y: 100, width: 300, height: 100 });
    }
  }, []);

  // Переход к следующему шагу
  const handleNextStep = useCallback(() => {
    if (nextTutorialStepRef.current) {
      if (__DEV__) {
        console.log('⚠️ Already processing next step, ignoring...');
      }
      return;
    }

    if (__DEV__) {
      console.log(`➡️ Moving to next step from ${tutorialStep} to ${tutorialStep + 1}`);
    }
    nextTutorialStepRef.current = true;
    setIsProcessingNext(true);

    if (tutorialStep < steps.length - 1) {
      const nextStep = tutorialStep + 1;
      setTutorialStep(nextStep);
      setIsProcessingNext(false);
      nextTutorialStepRef.current = false;
    } else {
      finishTutorial();
    }
  }, [tutorialStep, steps.length]);

  // Переход к предыдущему шагу
  const prevTutorialStep = useCallback(() => {
    setHighlightedElement(null);

    if (tutorialStep > 0) {
      setTimeout(() => {
        setTutorialStep((prev) => prev - 1);
      }, 50);
    }
  }, [tutorialStep]);

  // Завершение туториала
  const finishTutorial = useCallback(async () => {
    try {
      if (__DEV__) {
        console.log('✅ Finishing tutorial...');
      }
      setHighlightedElement(null);
      setShowTutorial(false);
      setTutorialStep(0);
      setIsProcessingNext(false);
      nextTutorialStepRef.current = false;
      await AsyncStorage.setItem(storageKey, 'true');
      if (__DEV__) {
        console.log('✅ Tutorial completed and saved');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error saving tutorial status:', error);
      }
      setShowTutorial(false);
      setTutorialStep(0);
      setHighlightedElement(null);
      setIsProcessingNext(false);
      nextTutorialStepRef.current = false;
    }
  }, [storageKey]);

  // Пропуск туториала
  const skipTutorial = useCallback(() => {
    if (__DEV__) {
      console.log('⏭️ Skipping tutorial...');
    }
    finishTutorial();
  }, [finishTutorial]);

  // Обновление позиции подсветки при изменении шага
  useEffect(() => {
    if (!showTutorial) {
      return;
    }

    if (tutorialStep < 0 || tutorialStep >= steps.length) {
      if (__DEV__) {
        console.warn(`⚠️ Invalid tutorial step: ${tutorialStep}, max: ${steps.length - 1}`);
      }
      return;
    }

    const step = steps[tutorialStep];
    if (!step) {
      if (__DEV__) {
        console.warn(`⚠️ Step ${tutorialStep} not found`);
      }
      return;
    }

    if (__DEV__) {
      console.log(`📍 Tutorial step ${tutorialStep + 1}: ${step.id}`);
    }

    if (!highlightedElement) {
      const defaultCoords = {
        x: 20,
        y: tutorialStep === 0 ? 50 : tutorialStep === 1 ? 130 : tutorialStep === 2 ? 300 : tutorialStep === 3 ? 450 : 50,
        width: 350,
        height: tutorialStep === 0 ? 100 : tutorialStep === 1 ? 150 : tutorialStep === 2 ? 100 : tutorialStep === 3 ? 100 : 100,
      };
      setHighlightedElement(defaultCoords);
    }

    if (nextTutorialStepRef.current) {
      nextTutorialStepRef.current = false;
    }

    const timeoutId = setTimeout(() => {
      if (step && step.ref) {
        if (step.ref.current) {
          measureElement(step.ref);
        } else {
          if (__DEV__) {
            console.warn(`⚠️ Step ${tutorialStep} ref.current is null, will retry...`);
          }
          setTimeout(() => {
            if (step.ref.current) {
              measureElement(step.ref);
            }
          }, 500);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [tutorialStep, showTutorial, steps, measureElement]);

  return {
    showTutorial,
    tutorialStep,
    highlightedElement,
    isProcessingNext,
    checkTutorialStatus,
    handleElementLayout,
    handleNextStep,
    prevTutorialStep,
    finishTutorial,
    skipTutorial,
  };
};
