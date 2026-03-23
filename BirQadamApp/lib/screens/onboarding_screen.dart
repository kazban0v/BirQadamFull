import 'package:flutter/material.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../l10n/app_localizations.dart';
import '../theme/app_colors.dart';
import 'onboarding/welcome_screen.dart';
import 'onboarding/check_account_screen.dart';
import 'onboarding/notification_permission_screen.dart';
import 'onboarding/location_permission_screen.dart';
import 'onboarding/final_welcome_screen.dart';

/// Onboarding Screen - показывается только при первом запуске
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  // Список onboarding страниц
  final List<Widget> _pages = const [
    WelcomeScreen(),
    CheckAccountScreen(),
    NotificationPermissionScreen(),
    LocationPermissionScreen(),
    FinalWelcomeScreen(),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Переход на следующую страницу
  void _nextPage() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  /// Пропустить onboarding
  void _skipOnboarding() {
    _pageController.animateToPage(
      _pages.length - 1,
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeInOut,
    );
  }

  /// Завершить onboarding и сохранить флаг
  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_completed', true);

    if (mounted) {
      // Переход на экран авторизации
      Navigator.of(context).pushReplacementNamed('/auth');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.onboardingGradient,
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Skip button
              if (_currentPage < _pages.length - 1)
                Align(
                  alignment: Alignment.topRight,
                  child: TextButton(
                    onPressed: _skipOnboarding,
                    child: Text(
                      l10n.t('onboarding_skip'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),

              // PageView
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: (index) {
                    setState(() {
                      _currentPage = index;
                    });
                  },
                  itemCount: _pages.length,
                  itemBuilder: (context, index) {
                    return _pages[index];
                  },
                ),
              ),

              // Page indicator
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: SmoothPageIndicator(
                  controller: _pageController,
                  count: _pages.length,
                  effect: const WormEffect(
                    activeDotColor: AppColors.accentLight,
                    dotColor: Colors.white54,
                    dotHeight: 12,
                    dotWidth: 12,
                    spacing: 16,
                  ),
                ),
              ),

              // Next/Done button
              Padding(
                padding: const EdgeInsets.all(24),
                child: SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _nextPage,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 4,
                    ),
                    child: Text(
                      _currentPage == _pages.length - 1
                          ? l10n.t('onboarding_get_started')
                          : l10n.t('next'),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
