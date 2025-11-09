// lib/screens/settings_screen.dart
/// ⚙️ Экран настроек приложения - Улучшенная версия

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../profile/edit_profile_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen>
    with TickerProviderStateMixin {
  String _appVersion = '...';
  late AnimationController _headerController;
  late AnimationController _listController;
  late Animation<double> _headerAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
    _initAnimations();
  }

  void _initAnimations() {
    _headerController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );

    _listController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );

    _headerAnimation = CurvedAnimation(
      parent: _headerController,
      curve: Curves.easeOutCubic,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _listController,
      curve: Curves.easeOut,
    );

    _headerController.forward();
    Future.delayed(const Duration(milliseconds: 200), () {
      _listController.forward();
    });
  }

  @override
  void dispose() {
    _headerController.dispose();
    _listController.dispose();
    super.dispose();
  }

  Future<void> _loadAppVersion() async {
    final packageInfo = await PackageInfo.fromPlatform();
    setState(() {
      _appVersion = packageInfo.version;
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final settingsProvider = context.watch<SettingsProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: isDark
            ? const Color(0xFF1A1A2E)
            : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_rounded,
            color: isDark ? Colors.white : const Color(0xFF1A1A2E),
          ),
          onPressed: () => Navigator.pop(context),
          tooltip: 'Назад',
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [
                    const Color(0xFF1A1A2E),
                    const Color(0xFF16213E),
                    const Color(0xFF0F1419),
                  ]
                : [
                    Colors.white,
                    Colors.white,
                    Colors.white,
                  ],
          ),
        ),
        child: SafeArea(
          child: CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              // Анимированный заголовок
              SliverToBoxAdapter(
                child: FadeTransition(
                  opacity: _headerAnimation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, -0.3),
                      end: Offset.zero,
                    ).animate(_headerAnimation),
                    child: _buildAnimatedHeader(isDark),
                  ),
                ),
              ),

              // Основной контент с анимацией
              SliverToBoxAdapter(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Column(
                      children: [
                        _buildAnimatedSection(
                          title: 'ОСНОВНЫЕ',
                          delay: 0,
                          isDark: isDark,
                          children: [
                            _buildNotificationToggle(settingsProvider),
                            const SizedBox(height: 12),
                            _buildAutoNetworkSwitch(settingsProvider, isDark), // ✅ NEW
                            const SizedBox(height: 12),
                            _buildApiUrlSetting(settingsProvider, isDark),
                          ],
                        ),
                        _buildAnimatedSection(
                          title: 'ПРОФИЛЬ',
                          delay: 100,
                          isDark: isDark,
                          children: [
                            _buildEnhancedListTile(
                              icon: Icons.person_rounded,
                              title: 'Редактировать профиль',
                              subtitle: 'Изменить имя, email и другую информацию',
                              gradientColors: const [
                                Color(0xFF2196F3),
                                Color(0xFF1976D2),
                              ],
                              onTap: () async {
                                final result = await Navigator.push(
                                  context,
                                  PageRouteBuilder(
                                    pageBuilder: (context, animation,
                                            secondaryAnimation) =>
                                        const EditProfileScreen(),
                                    transitionsBuilder: (context, animation,
                                        secondaryAnimation, child) {
                                      return FadeTransition(
                                        opacity: animation,
                                        child: SlideTransition(
                                          position: Tween<Offset>(
                                            begin: const Offset(0.1, 0),
                                            end: Offset.zero,
                                          ).animate(CurvedAnimation(
                                            parent: animation,
                                            curve: Curves.easeOutCubic,
                                          )),
                                          child: child,
                                        ),
                                      );
                                    },
                                  ),
                                );
                                
                                // Обновляем профиль после редактирования
                                if (result == true && mounted) {
                                  await context.read<AuthProvider>().refreshUser();
                                }
                              },
                            ),
                            const SizedBox(height: 12),
                            _buildEnhancedListTile(
                              icon: Icons.logout_rounded,
                              title: 'Выход из аккаунта',
                              subtitle: 'Выйти из текущего аккаунта',
                              gradientColors: const [
                                Color(0xFFFF5252),
                                Color(0xFFE53935),
                              ],
                              onTap: () => _confirmLogout(context, authProvider),
                            ),
                          ],
                        ),
                        _buildAnimatedSection(
                          title: 'ПОДДЕРЖКА',
                          delay: 200,
                          isDark: isDark,
                          children: [
                            _buildEnhancedListTile(
                              icon: Icons.support_agent_rounded,
                              title: 'Написать в поддержку',
                              subtitle: 'Связаться с администратором',
                              gradientColors: const [
                                Color(0xFF4CAF50),
                                Color(0xFF388E3C),
                              ],
                              onTap: () => _contactSupport(context),
                            ),
                          ],
                        ),
                        _buildAnimatedSection(
                          title: 'О ПРИЛОЖЕНИИ',
                          delay: 300,
                          isDark: isDark,
                          children: [
                            _buildEnhancedListTile(
                              icon: Icons.info_rounded,
                              title: 'О приложении',
                              subtitle: 'Версия $_appVersion',
                              gradientColors: const [
                                Color(0xFF9C27B0),
                                Color(0xFF7B1FA2),
                              ],
                              onTap: () => _showAboutDialog(context),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
                      ],
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

  /// Анимированный заголовок
  Widget _buildAnimatedHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isDark
                        ? [
                            const Color(0xFF4CAF50),
                            const Color(0xFF66BB6A),
                          ]
                        : [
                            const Color(0xFF2E7D32),
                            const Color(0xFF4CAF50),
                          ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF4CAF50).withValues(alpha: 0.4),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.settings_rounded,
                  color: Colors.white,
                  size: 32,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Настройки',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Управление профилем и приложением',
                      style: TextStyle(
                        fontSize: 14,
                        color:
                            isDark ? Colors.grey[400] : const Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Анимированная секция с задержкой
  Widget _buildAnimatedSection({
    required String title,
    required int delay,
    required bool isDark,
    required List<Widget> children,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 500 + delay),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 30 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: isDark
                      ? const Color(0xFF64748B)
                      : const Color(0xFF94A3B8),
                  letterSpacing: 1.5,
                ),
              ),
            ),
            ...children,
          ],
        ),
      ),
    );
  }

  /// ✅ NEW: Переключатель автоматического переключения по сети
  Widget _buildAutoNetworkSwitch(SettingsProvider settingsProvider, bool isDark) {
    final isEnabled = settingsProvider.autoNetworkSwitch;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        gradient: isEnabled
            ? LinearGradient(
                colors: isDark
                    ? [
                        const Color(0xFF2196F3).withValues(alpha: 0.15),
                        const Color(0xFF1976D2).withValues(alpha: 0.1),
                      ]
                    : [
                        const Color(0xFF2196F3).withValues(alpha: 0.08),
                        const Color(0xFF1976D2).withValues(alpha: 0.05),
                      ],
              )
            : null,
        color: isEnabled
            ? null
            : (isDark ? const Color(0xFF1E1E2E) : Colors.white),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isEnabled
              ? const Color(0xFF2196F3).withValues(alpha: 0.4)
              : (isDark
                  ? const Color(0xFF2E3A4D)
                  : const Color(0xFFE2E8F0)),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: isEnabled
                ? const Color(0xFF2196F3).withValues(alpha: 0.2)
                : Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () async {
            await settingsProvider.setAutoNetworkSwitch(!isEnabled);
            if (mounted) {
              _showCustomSnackBar(
                context,
                isEnabled
                    ? '📡 Автопереключение IP выключено'
                    : '✅ Автопереключение IP включено',
                isEnabled ? Colors.grey : const Color(0xFF2196F3),
              );
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isEnabled
                          ? [
                              const Color(0xFF2196F3),
                              const Color(0xFF1976D2),
                            ]
                          : [
                              isDark
                                  ? const Color(0xFF2E3A4D)
                                  : const Color(0xFFE2E8F0),
                              isDark
                                  ? const Color(0xFF3A4A5F)
                                  : const Color(0xFFF1F5F9),
                            ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: isEnabled
                        ? [
                            BoxShadow(
                              color: const Color(0xFF2196F3)
                                  .withValues(alpha: 0.4),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(
                    isEnabled
                        ? Icons.wifi_rounded
                        : Icons.wifi_off_rounded,
                    color: isEnabled
                        ? Colors.white
                        : (isDark ? Colors.grey[600] : Colors.grey[400]),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Автопереключение IP',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                        ),
                      ),
                      const SizedBox(height: 6),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        child: Text(
                          isEnabled
                              ? 'Автоматически менять IP при смене Wi-Fi'
                              : 'Ручное управление IP адресом',
                          key: ValueKey(isEnabled),
                          style: TextStyle(
                            fontSize: 13,
                            color: isDark
                                ? Colors.grey[400]
                                : const Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Transform.scale(
                  scale: 0.9,
                  child: Switch(
                    value: isEnabled,
                    onChanged: (value) async {
                      await settingsProvider.setAutoNetworkSwitch(value);
                      if (mounted) {
                        _showCustomSnackBar(
                          context,
                          value
                              ? '✅ Автопереключение включено'
                              : '📡 Автопереключение выключено',
                          value ? const Color(0xFF2196F3) : Colors.grey,
                        );
                      }
                    },
                    activeThumbColor: const Color(0xFF2196F3),
                    activeTrackColor:
                        const Color(0xFF2196F3).withValues(alpha: 0.5),
                    inactiveThumbColor:
                        isDark ? Colors.grey[700] : Colors.grey[400],
                    inactiveTrackColor:
                        isDark ? Colors.grey[800] : Colors.grey[300],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Улучшенный переключатель уведомлений
  Widget _buildNotificationToggle(SettingsProvider settingsProvider) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isEnabled = settingsProvider.notificationsEnabled;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        gradient: isEnabled
            ? LinearGradient(
                colors: isDark
                    ? [
                        const Color(0xFF4CAF50).withValues(alpha: 0.15),
                        const Color(0xFF66BB6A).withValues(alpha: 0.1),
                      ]
                    : [
                        const Color(0xFF4CAF50).withValues(alpha: 0.08),
                        const Color(0xFF66BB6A).withValues(alpha: 0.05),
                      ],
              )
            : null,
        color: isEnabled
            ? null
            : (isDark ? const Color(0xFF1E1E2E) : Colors.white),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isEnabled
              ? const Color(0xFF4CAF50).withValues(alpha: 0.4)
              : (isDark
                  ? const Color(0xFF2E3A4D)
                  : const Color(0xFFE2E8F0)),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: isEnabled
                ? const Color(0xFF4CAF50).withValues(alpha: 0.2)
                : Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () async {
            await settingsProvider
                .setNotificationsEnabled(!isEnabled);
            if (mounted) {
              _showCustomSnackBar(
                context,
                isEnabled
                    ? '🔕 Уведомления отключены'
                    : '🔔 Уведомления включены',
                isEnabled ? Colors.grey : const Color(0xFF4CAF50),
              );
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isEnabled
                          ? [
                              const Color(0xFFFF9800),
                              const Color(0xFFFFA726),
                            ]
                          : [
                              isDark
                                  ? const Color(0xFF2E3A4D)
                                  : const Color(0xFFE2E8F0),
                              isDark
                                  ? const Color(0xFF3A4A5F)
                                  : const Color(0xFFF1F5F9),
                            ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: isEnabled
                        ? [
                            BoxShadow(
                              color: const Color(0xFFFF9800)
                                  .withValues(alpha: 0.4),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(
                    isEnabled
                        ? Icons.notifications_active_rounded
                        : Icons.notifications_off_rounded,
                    color: isEnabled
                        ? Colors.white
                        : (isDark ? Colors.grey[600] : Colors.grey[400]),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Уведомления',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                        ),
                      ),
                      const SizedBox(height: 6),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        child: Text(
                          isEnabled
                              ? 'Получать push-уведомления о событиях'
                              : 'Push-уведомления отключены',
                          key: ValueKey(isEnabled),
                          style: TextStyle(
                            fontSize: 13,
                            color: isDark
                                ? Colors.grey[400]
                                : const Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Transform.scale(
                  scale: 0.9,
                  child: Switch(
                    value: isEnabled,
                    onChanged: (value) async {
                      await settingsProvider.setNotificationsEnabled(value);
                      if (mounted) {
                        _showCustomSnackBar(
                          context,
                          value
                              ? '🔔 Уведомления включены'
                              : '🔕 Уведомления отключены',
                          value ? const Color(0xFF4CAF50) : Colors.grey,
                        );
                      }
                    },
                    activeThumbColor: const Color(0xFF4CAF50),
                    activeTrackColor:
                        const Color(0xFF4CAF50).withValues(alpha: 0.5),
                    inactiveThumbColor:
                        isDark ? Colors.grey[700] : Colors.grey[400],
                    inactiveTrackColor:
                        isDark ? Colors.grey[800] : Colors.grey[300],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// ✅ NEW: Настройка API URL (IP адреса)
  Widget _buildApiUrlSetting(SettingsProvider settingsProvider, bool isDark) {
    final currentUrl = settingsProvider.customApiUrl;
    final defaultUrl = 'http://10.0.2.2:8000'; // Default для эмулятора
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? const Color(0xFF2E3A4D)
              : const Color(0xFF2196F3).withValues(alpha: 0.15),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showApiUrlDialog(context, settingsProvider, currentUrl),
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF2196F3), Color(0xFF1976D2)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF2196F3).withValues(alpha: 0.4),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.settings_ethernet_rounded, color: Colors.white, size: 26),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'IP адрес сервера',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        currentUrl ?? 'По умолчанию ($defaultUrl)',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark
                              ? Colors.grey[400]
                              : const Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2196F3).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: Color(0xFF2196F3),
                    size: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// ✅ NEW: Диалог для ввода API URL
  Future<void> _showApiUrlDialog(
    BuildContext context,
    SettingsProvider settingsProvider,
    String? currentUrl,
  ) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final controller = TextEditingController(text: currentUrl ?? '');
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      builder: (context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: 1.0),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        builder: (context, value, child) {
          return Transform.scale(
            scale: value,
            child: Opacity(opacity: value, child: child),
          );
        },
        child: AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E1E2E) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2196F3), Color(0xFF1976D2)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.settings_ethernet_rounded, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Настройка сервера',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                  ),
                ),
              ),
            ],
          ),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Введите IP адрес сервера:',
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.grey[400] : const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: controller,
                  style: TextStyle(color: isDark ? Colors.white : const Color(0xFF1A1A2E)),
                  decoration: InputDecoration(
                    hintText: 'http://192.168.1.100:8000',
                    hintStyle: TextStyle(color: Colors.grey[500]),
                    filled: true,
                    fillColor: isDark ? const Color(0xFF2E3A4D) : Colors.grey[100],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                        color: isDark ? const Color(0xFF2E3A4D) : Colors.grey[300]!,
                        width: 1.5,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(
                        color: Color(0xFF2196F3),
                        width: 2,
                      ),
                    ),
                    prefixIcon: const Icon(Icons.link_rounded, color: Color(0xFF2196F3)),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return null; // Пустое значение = использовать по умолчанию
                    }
                    if (!value.startsWith('http://') && !value.startsWith('https://')) {
                      return 'URL должен начинаться с http:// или https://';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                Text(
                  'Оставьте пустым для использования значения по умолчанию',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[600] : Colors.grey[500],
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Отмена',
                style: TextStyle(
                  color: isDark ? Colors.grey[400] : const Color(0xFF64748B),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                if (formKey.currentState!.validate()) {
                  final url = controller.text.trim();
                  await settingsProvider.setCustomApiUrl(url.isEmpty ? null : url);
                  
                  if (mounted) {
                    Navigator.pop(context);
                    _showCustomSnackBar(
                      context,
                      url.isEmpty
                          ? '✅ Используется адрес по умолчанию'
                          : '✅ IP адрес сохранен: $url',
                      const Color(0xFF4CAF50),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2196F3),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('Сохранить', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );

    controller.dispose();
  }

  /// Улучшенный элемент списка с градиентом
  Widget _buildEnhancedListTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required List<Color> gradientColors,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 0),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? const Color(0xFF2E3A4D)
              : gradientColors[0].withValues(alpha: 0.15),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Hero(
                  tag: title,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: gradientColors,
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: gradientColors[0].withValues(alpha: 0.4),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(icon, color: Colors.white, size: 26),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark
                              ? Colors.grey[400]
                              : const Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: gradientColors[0].withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: gradientColors[0],
                    size: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Кастомный SnackBar
  void _showCustomSnackBar(BuildContext context, String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(
                message.contains('включены')
                    ? Icons.check_circle_rounded
                    : Icons.cancel_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 2),
        elevation: 8,
      ),
    );
  }

  /// Подтверждение выхода
  Future<void> _confirmLogout(
      BuildContext context, AuthProvider authProvider) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: 1.0),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        builder: (context, value, child) {
          return Transform.scale(
            scale: value,
            child: Opacity(
              opacity: value,
              child: child,
            ),
          );
        },
        child: AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E1E2E) : Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: const EdgeInsets.all(24),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF5252), Color(0xFFE53935)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFF5252).withValues(alpha: 0.4),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.logout_rounded,
                  color: Colors.white,
                  size: 36,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Выход из аккаунта',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Вы уверены, что хотите выйти из приложения?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  color: isDark ? Colors.grey[400] : const Color(0xFF64748B),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context, false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: BorderSide(
                          color: isDark
                              ? const Color(0xFF2E3A4D)
                              : const Color(0xFFE2E8F0),
                          width: 2,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        'Отмена',
                        style: TextStyle(
                          color: isDark
                              ? Colors.grey[400]
                              : const Color(0xFF64748B),
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF5252),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Выйти',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed == true && mounted) {
      await authProvider.logout();
      
      // Закрываем экран настроек и возвращаемся к авторизации
      if (mounted) {
        // Закрываем все экраны до корневого
        Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
      }
    }
  }

  /// Написать в поддержку
  Future<void> _contactSupport(BuildContext context) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final choice = await showDialog<String>(
      context: context,
      builder: (context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: 1.0),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        builder: (context, value, child) {
          return Transform.scale(
            scale: value,
            child: Opacity(
              opacity: value,
              child: child,
            ),
          );
        },
        child: AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E1E2E) : Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: const EdgeInsets.all(24),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4CAF50), Color(0xFF388E3C)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF4CAF50).withValues(alpha: 0.4),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.support_agent_rounded,
                  color: Colors.white,
                  size: 36,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Связаться с поддержкой',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : const Color(0xFF1A1A2E),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Выберите удобный способ связи:',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  color: isDark ? Colors.grey[400] : const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 24),
              _buildContactButton(
                icon: Icons.email_rounded,
                label: 'Email',
                color: const Color(0xFF2196F3),
                isDark: isDark,
                onTap: () => Navigator.pop(context, 'email'),
              ),
              const SizedBox(height: 12),
              _buildContactButton(
                icon: Icons.telegram_rounded,
                label: 'Telegram',
                color: const Color(0xFF2196F3),
                isDark: isDark,
                onTap: () => Navigator.pop(context, 'telegram'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Отмена',
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : const Color(0xFF64748B),
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (choice == 'email') {
      final Uri emailUri = Uri(
        scheme: 'mailto',
        path: 'birqadsupport@mail.ru',
        query: 'subject=Поддержка CleanUp Almaty&body=Здравствуйте,%0A%0A',
      );
      if (await canLaunchUrl(emailUri)) {
        await launchUrl(emailUri);
      }
    } else if (choice == 'telegram') {
      final Uri telegramUri = Uri.parse('https://t.me/cleanupalmaty_support');
      if (await canLaunchUrl(telegramUri)) {
        await launchUrl(telegramUri, mode: LaunchMode.externalApplication);
      }
    }
  }

  Widget _buildContactButton({
    required IconData icon,
    required String label,
    required Color color,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.15),
            color.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: color, size: 24),
                const SizedBox(width: 12),
                Text(
                  label,
                  style: TextStyle(
                    color: color,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Диалог "О приложении"
  void _showAboutDialog(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.0, end: 1.0),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        builder: (context, value, child) {
          return Transform.scale(
            scale: value,
            child: Opacity(
              opacity: value,
              child: child,
            ),
          );
        },
        child: AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E1E2E) : Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: EdgeInsets.zero,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(24),
                    topRight: Radius.circular(24),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF4CAF50).withValues(alpha: 0.4),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.eco_rounded,
                        color: Colors.white,
                        size: 48,
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'BirQadam',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        'Версия $_appVersion',
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Text(
                      'Создавай перемены вокруг себя. Присоединяйся к сообществу волонтёров!',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 15,
                        color: isDark
                            ? Colors.grey[400]
                            : const Color(0xFF64748B),
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFF4CAF50).withValues(alpha: 0.15),
                            const Color(0xFF66BB6A).withValues(alpha: 0.05),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.eco_rounded,
                            color: Color(0xFF4CAF50),
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Делаем город чище вместе!',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: isDark
                                    ? Colors.white
                                    : const Color(0xFF4CAF50),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4CAF50),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 0,
                        ),
                        child: const Text(
                          'Закрыть',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}