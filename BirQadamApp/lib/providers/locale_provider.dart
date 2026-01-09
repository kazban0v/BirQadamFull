import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocaleProvider extends ChangeNotifier {
  Locale _locale = const Locale('ru', 'RU');

  Locale get locale => _locale;

  LocaleProvider() {
    _loadLocale();
  }

  Future<void> _loadLocale() async {
    final prefs = await SharedPreferences.getInstance();
    final languageCode = prefs.getString('language_code') ?? 'ru';
    final countryCode = prefs.getString('country_code') ?? 'RU';
    _locale = Locale(languageCode, countryCode);
    notifyListeners();
  }

  Future<void> setLocale(Locale locale) async {
    if (!['ru', 'kk', 'en'].contains(locale.languageCode)) {
      return;
    }

    _locale = locale;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('language_code', locale.languageCode);
    await prefs.setString('country_code', locale.countryCode ?? '');
  }

  Future<void> setRussian() => setLocale(const Locale('ru', 'RU'));
  Future<void> setKazakh() => setLocale(const Locale('kk', 'KZ'));
  Future<void> setEnglish() => setLocale(const Locale('en', 'US'));

  bool get isRussian => _locale.languageCode == 'ru';
  bool get isKazakh => _locale.languageCode == 'kk';
  bool get isEnglish => _locale.languageCode == 'en';

  // Alias for currentLocale to match existing code
  Locale get currentLocale => _locale;
}
