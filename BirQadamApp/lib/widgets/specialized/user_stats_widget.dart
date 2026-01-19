// lib/widgets/user_stats_widget.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/user_stats_provider.dart';
import '../../models/user_stats.dart';
import '../../screens/error/error_screen.dart';

class UserStatsWidget extends StatefulWidget {
  const UserStatsWidget({super.key});

  @override
  State<UserStatsWidget> createState() => _UserStatsWidgetState();
}

class _UserStatsWidgetState extends State<UserStatsWidget> {
  @override
  void initState() {
    super.initState();
    // Загружаем статистику при первом показе
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<UserStatsProvider>().fetchUserStats();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<UserStatsProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading && !provider.hasData) {
          return const Center(
            child: CircularProgressIndicator(
              color: Color(0xFF4CAF50),
            ),
          );
        }

        if (provider.error != null && !provider.hasData) {
          // Проверяем, это ошибка сети или другая ошибка
          final error = provider.error!.toLowerCase();
          if (error.contains('подключения') || 
              error.contains('connection') || 
              error.contains('network') || 
              error.contains('socketexception') ||
              error.contains('clientexception') ||
              error.contains('unreachable') ||
              error.contains('timed out') ||
              error.contains('failed host lookup')) {
            // Показываем экран ошибки сети
            return Center(
              child: ErrorScreens.noInternet(
                onRetry: () => provider.refresh(),
                onClose: () {},
              ),
            );
          } else {
            // Другие ошибки показываем через ErrorScreen.loadError
            return Center(
              child: ErrorScreens.loadError(
                onRetry: () => provider.refresh(),
                onClose: () {},
              ),
            );
          }
        }

        if (!provider.hasData) {
          return const Center(
            child: Text('Нет данных'),
          );
        }

        final stats = provider.stats!;

        return RefreshIndicator(
          onRefresh: () => provider.refresh(),
          color: const Color(0xFF4CAF50),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 📊 Статистика
                _buildStatsSection(stats),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatsSection(UserStats stats) {
    // Debug: проверяем роль
    debugPrint('📊 UserStatsWidget: role = ${stats.role}');
    
    // Определяем цвет и заголовок в зависимости от роли
    final isOrganizer = stats.role == 'organizer';
    final mainColor = isOrganizer ? const Color(0xFF1976D2) : const Color(0xFF4CAF50);
    final title = isOrganizer ? 'Статистика' : 'Моя статистика';
    
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            mainColor.withValues(alpha: 0.1),
            mainColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: mainColor.withValues(alpha: 0.3),
          width: 2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Заголовок
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: mainColor,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: mainColor.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(
                  isOrganizer ? Icons.business_center : Icons.bar_chart,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),
              Text(
                title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: isOrganizer ? const Color(0xFF1565C0) : const Color(0xFF2E7D32),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 20),
          
          // Карточки статистики
          if (stats.role == 'volunteer')
            _buildVolunteerStats(stats)
          else if (stats.role == 'organizer')
            _buildOrganizerStats(stats)
          else
            Center(
              child: Text(
                'Роль не определена: ${stats.role}',
                style: const TextStyle(color: Colors.red),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildVolunteerStats(UserStats stats) {
    debugPrint('📊 Building VOLUNTEER stats: projects=${stats.projectsCount}, tasks=${stats.tasksCount}, photos=${stats.photoReportsCount}');
    
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                'Проекты',
                stats.projectsCount.toString(),
                Icons.folder_open,
                const Color(0xFF4CAF50),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Задачи',
                '${stats.completedTasksCount}/${stats.tasksCount}',
                Icons.task_alt,
                const Color(0xFF2196F3),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                'Фотоотчеты',
                stats.photoReportsCount.toString(),
                Icons.photo_camera,
                const Color(0xFFFF9800),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Достижения',
                (stats.achievementsCount ?? 0).toString(),
                Icons.emoji_events,
                const Color(0xFFFFC107),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildOrganizerStats(UserStats stats) {
    debugPrint('📊 Building ORGANIZER stats: projects=${stats.projectsCount}, active=${stats.activeProjectsCount}, volunteers=${stats.volunteersCount}');
    
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                'Всего проектов',
                stats.projectsCount.toString(),
                Icons.folder_open,
                const Color(0xFF1976D2),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Активных',
                (stats.activeProjectsCount ?? 0).toString(),
                Icons.trending_up,
                const Color(0xFF4CAF50),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                'Завершенных',
                (stats.completedProjectsCount ?? 0).toString(),
                Icons.check_circle,
                const Color(0xFF43A047),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Волонтеров',
                (stats.volunteersCount ?? 0).toString(),
                Icons.people,
                const Color(0xFFFF9800),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                'Задач создано',
                stats.tasksCount.toString(),
                Icons.assignment,
                const Color(0xFF2196F3),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Выполнено',
                stats.completedTasksCount.toString(),
                Icons.done_all,
                const Color(0xFF00BCD4),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[700],
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

}

