import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/locale_provider.dart';
import '../../l10n/app_localizations.dart';

class LanguageSelector extends StatelessWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);
    final localizations = AppLocalizations.of(context)!;

    return PopupMenuButton<Locale>(
      icon: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(50),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.language, color: Colors.white, size: 20),
            SizedBox(width: 4),
            Icon(Icons.arrow_drop_down, color: Colors.white, size: 20),
          ],
        ),
      ),
      onSelected: (Locale locale) {
        localeProvider.setLocale(locale);
      },
      itemBuilder: (BuildContext context) => <PopupMenuEntry<Locale>>[
        PopupMenuItem<Locale>(
          value: const Locale('ru', 'RU'),
          child: Row(
            children: [
              if (localeProvider.isRussian)
                const Icon(Icons.check, color: Color(0xFF4CAF50), size: 20)
              else
                const SizedBox(width: 20),
              const SizedBox(width: 8),
              const Text('🇷🇺', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Text(localizations.t('russian')),
            ],
          ),
        ),
        PopupMenuItem<Locale>(
          value: const Locale('kk', 'KZ'),
          child: Row(
            children: [
              if (localeProvider.isKazakh)
                const Icon(Icons.check, color: Color(0xFF4CAF50), size: 20)
              else
                const SizedBox(width: 20),
              const SizedBox(width: 8),
              const Text('🇰🇿', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Text(localizations.t('kazakh')),
            ],
          ),
        ),
        PopupMenuItem<Locale>(
          value: const Locale('en', 'US'),
          child: Row(
            children: [
              if (localeProvider.isEnglish)
                const Icon(Icons.check, color: Color(0xFF4CAF50), size: 20)
              else
                const SizedBox(width: 20),
              const SizedBox(width: 8),
              const Text('🇺🇸', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Text(localizations.t('english')),
            ],
          ),
        ),
      ],
    );
  }
}
