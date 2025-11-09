import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/locale_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/birqadam_logo.dart';

/// Экран 1: Приветствие с логотипом и превью
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final l10n = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Верхняя часть с логотипом BirQadam
          Column(
            children: [
              const SizedBox(height: 40),

              // Логотип BirQadam с горой, лесом и рекой
              const BirQadamLogo(size: 120),

                  const SizedBox(height: 48),

              // Language selector
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _LanguageButton(
                    label: 'РУС',
                    isSelected: localeProvider.currentLocale.languageCode == 'ru',
                    onTap: () => localeProvider.setRussian(),
                  ),
                  const SizedBox(width: 12),
                  _LanguageButton(
                    label: 'ҚАЗ',
                    isSelected: localeProvider.currentLocale.languageCode == 'kk',
                    onTap: () => localeProvider.setKazakh(),
                  ),
                  const SizedBox(width: 12),
                  _LanguageButton(
                    label: 'ENG',
                    isSelected: localeProvider.currentLocale.languageCode == 'en',
                    onTap: () => localeProvider.setEnglish(),
                  ),
                ],
              ),

              const SizedBox(height: 32),

              // Название приложения
              Text(
                l10n.t('onboarding_welcome_title'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 24,
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                ),
              ),

              const SizedBox(height: 16),

              // BirQadam Logo Text
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Text(
                  '🌟 BirQadam 🌟',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Описание
              Text(
                l10n.t('onboarding_welcome_subtitle'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),

              const SizedBox(height: 16),

              Text(
                l10n.t('onboarding_welcome_desc'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.white70,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Language selection button widget
class _LanguageButton extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _LanguageButton({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.5),
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isSelected ? AppColors.primary : Colors.white,
          ),
        ),
      ),
    );
  }
}
