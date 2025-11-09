import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../services/notifications/notification_service.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../config/app_config.dart';
import '../../providers/auth_provider.dart';
import '../../providers/volunteer_projects_provider.dart';
import '../../services/api/api_service.dart';
import '../../providers/volunteer_tasks_provider.dart';
import '../../providers/achievements_provider.dart';
import '../../providers/activity_provider.dart';
import '../../providers/photo_reports_provider.dart';  // 📸 NEW: Фотоотчеты
import '../../providers/theme_provider.dart';  // 🌙 NEW: Темная тема
import '../../providers/user_stats_provider.dart';  // 📊 NEW: Провайдер статистики
import '../../providers/chat_provider.dart';  // 💬 NEW: Провайдер чатов
import '../../widgets/specialized/volunteer_type_badge.dart';
import '../../widgets/dialogs/submit_photo_report_dialog.dart';
import '../../widgets/common/skeleton_loader.dart';
import '../../widgets/cards/swipeable_task_card.dart';
import '../../widgets/forms/filter_chip.dart';
import '../../widgets/specialized/pull_to_refresh.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/forms/search_bar_widget.dart';
import '../../widgets/common/app_avatar.dart';
import '../../widgets/specialized/projects_view_switcher.dart';  // 🗺️ NEW: Переключатель Список/Карта
import '../../widgets/specialized/user_stats_widget.dart';  // 📊 NEW: Статистика пользователя
import '../../utils/page_transitions.dart';
import '../other/achievements_gallery_screen.dart';
import '../calendar/calendar_screen.dart';  // 📅 NEW: Календарь событий
import '../settings/settings_screen.dart';  // ⚙️ NEW: Настройки
import '../chat/chats_list_screen.dart';  // 💬 NEW: Чаты
import '../error/error_screen.dart';
import '../../models/achievement.dart';
import '../../providers/geofence_provider.dart';  // 📍 NEW: Геолокационный провайдер
import '../../services/geofence/geofence_service.dart';  // 📍 NEW: Геолокационный сервис


class VolunteerPage extends StatefulWidget {
   const VolunteerPage({super.key});

   @override
   State<VolunteerPage> createState() => _VolunteerPageState();
 }

class _VolunteerPageState extends State<VolunteerPage> {
    int _selectedIndex = 0;
    String? _selectedFilter; // null = all, 'social', 'environmental', 'cultural'
    String _searchQuery = ''; // Поисковый запрос
    Map<int, Map<String, dynamic>> _taskPhotos = {}; // Кэш фото для задач

    @override
    void initState() {
      super.initState();
      _setupNotificationListeners();
      // Загружаем данные при инициализации
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // Отправляем FCM токен на сервер
        _sendFCMTokenToServer();

        context.read<VolunteerProjectsProvider>().loadProjects();
        context.read<VolunteerTasksProvider>().loadTasks();
        context.read<AchievementsProvider>().loadAchievements();
        context.read<ActivityProvider>().loadActivities();
        
        // 📍 Автозапуск геолокационного мониторинга
        _startGeofenceMonitoring();
      });
    }
    
    /// Автоматический запуск геолокационного мониторинга
    Future<void> _startGeofenceMonitoring() async {
      try {
        final geofenceProvider = context.read<GeofenceProvider>();
        final geofenceService = GeofenceService();
        
        // Запускаем мониторинг если есть активные напоминания
        await geofenceProvider.fetchReminders();
        if (geofenceProvider.reminders.isNotEmpty) {
          await geofenceService.startMonitoring(geofenceProvider);
          debugPrint('✅ Geofence monitoring auto-started with ${geofenceProvider.reminders.length} reminders');
        }
      } catch (e) {
        debugPrint('❌ Error auto-starting geofence monitoring: $e');
      }
    }

    // ИСПРАВЛЕНО: Добавлен dispose для очистки памяти
    @override
    void dispose() {
      _taskPhotos.clear(); // Очищаем кэш фото, чтобы избежать утечки памяти
      super.dispose();
    }

    Future<void> _sendFCMTokenToServer() async {
      final authProvider = context.read<AuthProvider>();
      final token = authProvider.token;

      if (token != null && token.isNotEmpty) {
        print('🔐 Volunteer page: Sending FCM token to server');
        await NotificationService().setAuthToken(token);
      } else {
        print('⚠️ Volunteer page: No auth token available');
      }
    }

    Future<Map<String, dynamic>> _loadTaskPhotos(int taskId) async {
      final token = context.read<AuthProvider>().token;
      if (token == null) return {'has_photos': false};

      try {
        final response = await http.get(
          Uri.parse('${ApiService.apiBase}/tasks/$taskId/photos/'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        );

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          return data as Map<String, dynamic>;
        }
      } catch (e) {
        print('Ошибка загрузки фото задачи: $e');
      }
      return {'has_photos': false};
    }

    void _setupNotificationListeners() {
      // Слушатель для уведомлений в foreground
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print('📱 Volunteer page: Получено уведомление в foreground');
        // Обновить данные при получении уведомления
        if (message.data['type'] == 'task_assigned' ||
            message.data['type'] == 'project_deleted' ||
            message.data['type'] == 'photo_rejected') {
          // Проверяем mounted перед использованием context
          if (mounted) {
            context.read<VolunteerProjectsProvider>().loadProjects();
            context.read<VolunteerTasksProvider>().loadTasks();
          }
        }
      });

      // Слушатель для уведомлений, открываемых из background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        print('📱 Volunteer page: Открыто уведомление из background');
        // Обновить данные при открытии уведомления
        if (mounted) {
          context.read<VolunteerProjectsProvider>().loadProjects();
          context.read<VolunteerTasksProvider>().loadTasks();
        }
      });
    }



  Future<Map<String, dynamic>?> _getUserProfile() async {
    final token = context.read<AuthProvider>().token;
    if (token == null) return null;

    try {
      final response = await http.get(
        Uri.parse('${AppConfig.profileUrl}'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('Ошибка получения профиля: $e');
    }
    return null;
  }

  Future<void> _joinProject(int projectId) async {
    final token = context.read<AuthProvider>().token;
    if (token == null) return;

    // Проверяем ограничение: волонтер может присоединиться только к 1 проекту
    final projects = context.read<VolunteerProjectsProvider>().projects;
    final joinedProjectsCount = projects.where((p) => p.isJoined).length;
    if (joinedProjectsCount >= 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Вы можете участвовать только в одном проекте одновременно'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      final response = await http.post(
        Uri.parse(ApiService.projectJoinUrl(projectId)),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Вы присоединились к проекту!'),
            backgroundColor: Colors.green,
          ),
        );

        // Обновить данные через провайдеры
        context.read<VolunteerProjectsProvider>().loadProjects();
        context.read<VolunteerTasksProvider>().loadTasks();
        context.read<ActivityProvider>().loadActivities(); // Обновить активности
      } else {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['error'] ?? 'Ошибка при присоединении'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      print('Ошибка присоединения к проекту: $e');
    }
  }

  Future<void> _leaveProject(int projectId) async {
    final authProvider = context.read<AuthProvider>();
    final token = authProvider.token;
    if (token == null) return;

    try {
      final response = await http.post(
        Uri.parse(ApiService.projectLeaveUrl(projectId)),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Вы покинули проект'),
            backgroundColor: Colors.blue,
          ),
        );

        // Обновить данные через провайдеры
        context.read<VolunteerProjectsProvider>().loadProjects();
        context.read<VolunteerTasksProvider>().loadTasks();
        context.read<ActivityProvider>().loadActivities(); // Обновить активности
      } else {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['error'] ?? 'Ошибка при выходе из проекта'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      print('Ошибка выхода из проекта: $e');
    }
  }

  String _formatDate(String? dateString) {
    if (dateString == null) return '';
    try {
      final date = DateTime.parse(dateString);
      return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}';
    } catch (e) {
      return dateString;
    }
  }

  String _formatTime(String? timeString) {
    if (timeString == null || timeString.isEmpty) return '';

    // Если время уже в правильном формате HH:MM, возвращаем как есть
    if (RegExp(r'^\d{1,2}:\d{2}$').hasMatch(timeString)) {
      final parts = timeString.split(':');
      final hour = int.parse(parts[0]);
      final minute = int.parse(parts[1]);
      return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
    }

    // Пробуем парсить как DateTime строку
    try {
      final time = DateTime.parse('2024-01-01 $timeString');
      return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      // Если не получилось, возвращаем оригинальную строку
      return timeString;
    }
  }

  bool _isTaskClosed(dynamic task) {
    // Проверяем дедлайн для автоматического закрытия
    if (task.deadlineDate != null && task.endTime != null) {
      try {
        final deadlineDate = DateTime.parse(task.deadlineDate!);
        final endTimeParts = task.endTime!.split(':');
        final deadlineDateTime = DateTime(
          deadlineDate.year,
          deadlineDate.month,
          deadlineDate.day,
          int.parse(endTimeParts[0]),
          int.parse(endTimeParts[1]),
        );

        if (DateTime.now().isAfter(deadlineDateTime) && task.status != 'completed') {
          return true;
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
    return task.status == 'closed';
  }

  Color _getTaskAvailabilityColor(dynamic task) {
    if (_isTaskClosed(task)) {
      return const Color(0xFF9E9E9E); // Серый для закрытых
    }
    if (task.isAssigned) {
      return const Color(0xFF4CAF50); // Зеленый для назначенных
    }
    return const Color(0xFFFF9800); // Оранжевый для доступных
  }

  IconData _getTaskAvailabilityIcon(dynamic task) {
    if (_isTaskClosed(task)) {
      return Icons.lock_clock; // Замок для закрытых
    }
    if (task.isAssigned) {
      return Icons.check_circle; // Галочка для назначенных
    }
    return Icons.schedule; // Часы для доступных
  }

  String _getTaskAvailabilityText(dynamic task) {
    if (_isTaskClosed(task)) {
      return 'Закрыто';
    }
    if (task.isAssigned) {
      return 'Назначено вам';
    }
    return 'Доступно';
  }

  void _showSubmitPhotoReportDialog(dynamic task) {
    showDialog(
      context: context,
      builder: (context) => SubmitPhotoReportDialog(
        taskId: task.id,
        taskText: task.text,
        projectTitle: task.projectTitle,
      ),
    ).then((result) {
      if (result == true) {
        // Обновляем задачи после успешной отправки
        context.read<VolunteerTasksProvider>().loadTasks();
      }
    });
  }

  Future<void> _acceptTask(int taskId) async {
    final token = context.read<AuthProvider>().token;
    if (token == null) return;

    try {
      final response = await http.post(
        Uri.parse('${ApiService.apiBase}/tasks/$taskId/accept/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Вы взялись за задачу!'),
            backgroundColor: Colors.green,
          ),
        );
        // Обновляем задачи
        context.read<VolunteerTasksProvider>().loadTasks();
      } else {
        final data = jsonDecode(response.body);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['error'] ?? 'Ошибка при принятии задачи'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      print('Ошибка принятия задачи: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ошибка подключения к серверу'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _declineTask(int taskId) async {
    // Показываем диалог подтверждения
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.red),
            SizedBox(width: 12),
            Text('Отклонить задачу'),
          ],
        ),
        content: const Text(
          'Эта задача будет закрыта для вас. Вы не сможете взяться за неё снова.',
          style: TextStyle(fontSize: 16),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Отмена'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Отклонить'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      // Отправляем запрос на отклонение задачи
      final token = context.read<AuthProvider>().token;
      if (token == null) return;

      try {
        final response = await http.post(
          Uri.parse('${ApiService.apiBase}/tasks/$taskId/decline/'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
        );

        if (response.statusCode == 200 || response.statusCode == 201) {
          final data = jsonDecode(response.body);
          if (!mounted) return;
          
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['message'] ?? 'Задача отклонена'),
              backgroundColor: Colors.red,
            ),
          );
          
          // Обновляем список задач
          context.read<VolunteerTasksProvider>().loadTasks();
        } else {
          final data = jsonDecode(response.body);
          if (!mounted) return;
          
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['error'] ?? 'Ошибка при отклонении задачи'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } catch (e) {
        print('Ошибка отклонения задачи: $e');
        if (!mounted) return;
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ошибка подключения к серверу'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // Вспомогательные методы для статусов фотоотчётов
  Color _getPhotoStatusColor(String status) {
    switch (status) {
      case 'approved':
        return const Color(0xFFE8F5E9);
      case 'rejected':
        return const Color(0xFFFFEBEE);
      case 'pending':
        return const Color(0xFFFFF8E1);
      default:
        return Colors.grey[100]!;
    }
  }

  Color _getPhotoStatusBorderColor(String status) {
    switch (status) {
      case 'approved':
        return const Color(0xFF4CAF50);
      case 'rejected':
        return const Color(0xFFF44336);
      case 'pending':
        return const Color(0xFFFFC107);
      default:
        return Colors.grey[300]!;
    }
  }

  IconData _getPhotoStatusIcon(String status) {
    switch (status) {
      case 'approved':
        return Icons.check_circle;
      case 'rejected':
        return Icons.cancel;
      case 'pending':
        return Icons.hourglass_empty;
      default:
        return Icons.info;
    }
  }

  Color _getPhotoStatusIconColor(String status) {
    switch (status) {
      case 'approved':
        return const Color(0xFF4CAF50);
      case 'rejected':
        return const Color(0xFFF44336);
      case 'pending':
        return const Color(0xFFFFC107);
      default:
        return Colors.grey;
    }
  }

  String _getPhotoStatusText(String status) {
    switch (status) {
      case 'approved':
        return 'Фотоотчёт одобрен';
      case 'rejected':
        return 'Фотоотчёт отклонён';
      case 'pending':
        return 'Ожидает проверки';
      default:
        return 'Неизвестный статус';
    }
  }

  Color _getPhotoStatusTextColor(String status) {
    switch (status) {
      case 'approved':
        return const Color(0xFF2E7D32);
      case 'rejected':
        return const Color(0xFFC62828);
      case 'pending':
        return const Color(0xFFF57C00);
      default:
        return Colors.black87;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'BirQadam',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).brightness == Brightness.dark
                ? Colors.white
                : const Color(0xFF2E7D32),
          ),
        ),
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? Theme.of(context).scaffoldBackgroundColor
            : Colors.white,
        elevation: 0,
        actions: [
          // 🌙 Переключатель темы
          IconButton(
            icon: Icon(
              context.watch<ThemeProvider>().isDarkMode
                  ? Icons.light_mode
                  : Icons.dark_mode_outlined,
            ),
            color: const Color(0xFF4CAF50),
            onPressed: () => context.read<ThemeProvider>().toggleTheme(),
            tooltip: context.watch<ThemeProvider>().isDarkMode
                ? 'Светлая тема'
                : 'Темная тема',
          ),
          // ⚙️ Настройки (только на вкладке профиля)
          if (_selectedIndex == 4)
            IconButton(
              icon: const Icon(Icons.settings),
              color: const Color(0xFF4CAF50),
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const SettingsScreen(),
                  ),
                );
                
                // Обновляем профиль после возврата из настроек
                if (mounted) {
                  await context.read<AuthProvider>().refreshUser();
                  setState(() {}); // Перерисовываем UI
                }
              },
              tooltip: 'Настройки',
            ),
        ],
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          _buildProjectsTab(),
          _buildTasksTab(),
          _buildCalendarTab(), // 📅 NEW: Календарь
          const ChatsListScreen(), // 💬 NEW: Чаты
          _buildProfileTab(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
          
          // Перезагружаем чаты при переходе на вкладку чатов
          if (index == 3) {
            context.read<ChatProvider>().loadChats();
          }
          // Перезагружаем статистику при переходе на вкладку профиля
          if (index == 4) {
            context.read<UserStatsProvider>().fetchUserStats();
          }
        },
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? Theme.of(context).bottomNavigationBarTheme.backgroundColor
            : Colors.white,
        selectedItemColor: const Color(0xFF4CAF50),
        unselectedItemColor: Theme.of(context).brightness == Brightness.dark
            ? Colors.grey[400]
            : Colors.grey,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
        type: BottomNavigationBarType.fixed, // Чтобы показать 5 вкладок
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.business),
            activeIcon: Icon(Icons.business, color: Color(0xFF4CAF50)),
            label: 'Проекты',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.task_alt),
            activeIcon: Icon(Icons.task_alt, color: Color(0xFF4CAF50)),
            label: 'Задачи',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_today),
            activeIcon: Icon(Icons.calendar_today, color: Color(0xFF4CAF50)),
            label: 'Календарь',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.chat_bubble_outline),
            activeIcon: Icon(Icons.chat_bubble, color: Color(0xFF4CAF50)),
            label: 'Чаты',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person, color: Color(0xFF4CAF50)),
            label: 'Профиль',
          ),
        ],
      ),
    );
  }

  // 🗺️ NEW: Метод для вкладки проектов с переключателем Список/Карта
  Widget _buildProjectsTab() {
    return ProjectsViewSwitcher(
      listView: _buildProjectsListContent(),
    );
  }

  // Контент списка проектов (используется в переключателе)
  Widget _buildProjectsListContent() {
    final projectsProvider = context.watch<VolunteerProjectsProvider>();

    if (projectsProvider.isLoading) {
      return const ListSkeleton(
        itemSkeleton: ProjectCardSkeleton(),
        itemCount: 5,
      );
    }

    // Проверяем ошибки сети перед показом пустого состояния
    if (projectsProvider.errorMessage != null && projectsProvider.projects.isEmpty) {
      final error = projectsProvider.errorMessage!.toLowerCase();
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
            onRetry: () => projectsProvider.loadProjects(),
            onClose: () {},
          ),
        );
      } else {
        // Другие ошибки показываем через стандартный виджет
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline_rounded,
                  size: 64,
                  color: Colors.grey[400],
                ),
                const SizedBox(height: 16),
                Text(
                  'Ошибка загрузки',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[700],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  projectsProvider.errorMessage!,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () => projectsProvider.loadProjects(),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Повторить'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4CAF50),
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        );
      }
    }

    // Apply filter and search
    var filteredProjects = _selectedFilter == null
        ? projectsProvider.projects
        : projectsProvider.projects.where((p) => p.volunteerType == _selectedFilter).toList();

    // Apply search
    if (_searchQuery.isNotEmpty) {
      filteredProjects = filteredProjects.where((p) =>
        p.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
        p.description.toLowerCase().contains(_searchQuery.toLowerCase())
      ).toList();
    }

    if (filteredProjects.isEmpty && _selectedFilter == null && _searchQuery.isEmpty) {
      return AppPullToRefresh(
        onRefresh: projectsProvider.loadProjects,
        child: ListView(
          children: [
            const SizedBox(height: 100),
            EmptyState(
              icon: Icons.eco,
              title: 'Нет доступных проектов',
              message: 'Потяните вниз для обновления',
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.all(16),
          child: SearchBarWidget(
            hintText: 'Поиск проектов...',
            onSearch: (value) {
              setState(() {
                _searchQuery = value;
              });
            },
            showFilter: false,
          ),
        ),

        // Filter chips using new FilterChipList
        FilterChipList(
          options: const [
            FilterOption(label: 'Все', value: 'all', icon: Icons.apps),
            FilterOption(label: 'Социальная', value: 'social', icon: Icons.handshake),
            FilterOption(label: 'Экологическая', value: 'environmental', icon: Icons.eco),
            FilterOption(label: 'Культурная', value: 'cultural', icon: Icons.theater_comedy),
          ],
          selectedValue: _selectedFilter ?? 'all',
          onSelected: (value) {
            setState(() {
              _selectedFilter = value == 'all' ? null : value;
            });
          },
        ),

        const SizedBox(height: 8),

        // Empty state if filtered/searched and no results
        if (filteredProjects.isEmpty)
          Expanded(
            child: EmptyState(
              icon: _searchQuery.isNotEmpty ? Icons.search_off : Icons.filter_alt_off,
              title: _searchQuery.isNotEmpty
                  ? 'Ничего не найдено'
                  : 'Нет проектов данного типа',
              message: _searchQuery.isNotEmpty
                  ? 'Попробуйте изменить запрос'
                  : 'Выберите другой фильтр',
            ),
          ),
        // Projects list
        if (filteredProjects.isNotEmpty)
          Expanded(
            child: AppPullToRefresh(
              onRefresh: projectsProvider.loadProjects,
              child: ListView.builder(
        itemCount: filteredProjects.length,
        itemBuilder: (context, index) {
          final project = filteredProjects[index];
          return Hero(
            tag: 'project_${project.id}',
            child: Material(
              type: MaterialType.transparency,
              child: Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          project.title,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF2E7D32),
                          ),
                        ),
                      ),
                      VolunteerTypeBadge(
                        volunteerTypeString: project.volunteerType,
                        showLabel: false,
                        size: 24,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  VolunteerTypeBadge(
                    volunteerTypeString: project.volunteerType,
                    showLabel: true,
                    size: 20,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    project.description,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.black87,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F8E9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Icon(Icons.location_on, size: 18, color: const Color(0xFF4CAF50)),
                            const SizedBox(width: 8),
                            Text(
                              project.city,
                              style: const TextStyle(fontSize: 14, color: Colors.black87),
                            ),
                            const SizedBox(width: 20),
                            Icon(Icons.person, size: 18, color: const Color(0xFF4CAF50)),
                            const SizedBox(width: 8),
                            Text(
                              project.creatorName,
                              style: const TextStyle(fontSize: 14, color: Colors.black87),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.group, size: 18, color: const Color(0xFF2196F3)),
                            const SizedBox(width: 8),
                            Text(
                              '${project.volunteerCount} волонтеров',
                              style: const TextStyle(fontSize: 14, color: Colors.black87),
                            ),
                            const SizedBox(width: 20),
                            Icon(Icons.task, size: 18, color: const Color(0xFFFF9800)),
                            const SizedBox(width: 8),
                            Text(
                              '${project.taskCount} задач',
                              style: const TextStyle(fontSize: 14, color: Colors.black87),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: project.isJoined ? () => _leaveProject(project.id) : () => _joinProject(project.id),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: project.isJoined
                            ? const Color(0xFFF44336) // Красный для выхода
                            : const Color(0xFF4CAF50), // Зеленый для присоединения
                        foregroundColor: Colors.white,
                        elevation: 3,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        project.isJoined ? 'Покинуть проект' : 'Присоединиться',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
              ),
            ),
          );
        },
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildTasksTab() {
    final tasksProvider = context.watch<VolunteerTasksProvider>();

    if (tasksProvider.isLoading) {
      return const ListSkeleton(
        itemSkeleton: TaskCardSkeleton(),
        itemCount: 8,
      );
    }

    // Проверяем ошибки сети перед показом пустого состояния
    if (tasksProvider.errorMessage != null && tasksProvider.tasks.isEmpty) {
      final error = tasksProvider.errorMessage!.toLowerCase();
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
            onRetry: () => tasksProvider.loadTasks(),
            onClose: () {},
          ),
        );
      } else {
        // Другие ошибки показываем через стандартный виджет
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline_rounded,
                  size: 64,
                  color: Colors.grey[400],
                ),
                const SizedBox(height: 16),
                Text(
                  'Ошибка загрузки',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[700],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  tasksProvider.errorMessage!,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () => tasksProvider.loadTasks(),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Повторить'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4CAF50),
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        );
      }
    }

    if (tasksProvider.tasks.isEmpty) {
      return RefreshIndicator(
        onRefresh: tasksProvider.loadTasks,
        child: ListView(
          children: const [
            SizedBox(height: 100),
            Center(
              child: Text('У вас нет активных заданий\n\nПотяните вниз для обновления'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: tasksProvider.loadTasks,
      child: ListView.builder(
        itemCount: tasksProvider.tasks.length,
        itemBuilder: (context, index) {
          final task = tasksProvider.tasks[index];
          return SwipeableTaskCard(
            onComplete: task.isAssigned && !_isTaskClosed(task)
                ? () => _showSubmitPhotoReportDialog(task)
                : null,
            canComplete: task.isAssigned && !_isTaskClosed(task),
            canDelete: false,
            child: Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            elevation: 3,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Название проекта - шапка
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F8E9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.business, size: 20, color: Color(0xFF4CAF50)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Проект "${task.projectTitle}"',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2E7D32),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    task.text,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.black87,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Информация об организаторе
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.person, size: 18, color: Color(0xFF4CAF50)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Организатор: ${task.creatorName.isEmpty ? "Неизвестно" : task.creatorName}',
                            style: const TextStyle(
                              fontSize: 14,
                              color: Colors.black87,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (task.deadlineDate != null || task.startTime != null || task.endTime != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3E0),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFF9800).withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (task.deadlineDate != null)
                            Row(
                              children: [
                                Icon(Icons.calendar_today, size: 18, color: const Color(0xFFF44336)),
                                const SizedBox(width: 8),
                                Text(
                                  'Дедлайн: ${_formatDate(task.deadlineDate)}',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Colors.black87,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          if (task.startTime != null || task.endTime != null) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Icon(Icons.access_time, size: 18, color: const Color(0xFF2196F3)),
                                const SizedBox(width: 8),
                                Text(
                                  'Время: ${_formatTime(task.startTime)} - ${_formatTime(task.endTime)}',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Colors.black87,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),

                  // Кнопки действий для доступных задач
                  if (!task.isAssigned && !_isTaskClosed(task)) ...[
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _acceptTask(task.id),
                            icon: const Icon(Icons.check_circle, size: 20),
                            label: const Text('Взяться за работу'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF4CAF50),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _declineTask(task.id),
                            icon: const Icon(Icons.cancel, size: 20),
                            label: const Text('Отклонить'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFF44336),
                              side: const BorderSide(color: Color(0xFFF44336), width: 2),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Кнопка отправки фотоотчета или статус фотоотчёта (только для назначенных задач)
                  if (task.isAssigned && !_isTaskClosed(task))
                    FutureBuilder<Map<String, dynamic>>(
                      future: _loadTaskPhotos(task.id),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            child: const Center(child: CircularProgressIndicator()),
                          );
                        }

                        final photoData = snapshot.data;
                        final hasPhotos = photoData?['has_photos'] == true;
                        final status = photoData?['latest_status'] ?? '';
                        final rating = photoData?['latest_rating'];
                        final organizerComment = photoData?['latest_organizer_comment'] ?? '';
                        final rejectionReason = photoData?['latest_rejection_reason'] ?? '';

                        // Если уже есть фотоотчёт, показываем статус
                        if (hasPhotos) {
                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: _getPhotoStatusColor(status),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: _getPhotoStatusBorderColor(status),
                                width: 2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: _getPhotoStatusBorderColor(status).withValues(alpha: 0.2),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: _getPhotoStatusIconColor(status).withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(
                                        _getPhotoStatusIcon(status),
                                        color: _getPhotoStatusIconColor(status),
                                        size: 24,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _getPhotoStatusText(status),
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: _getPhotoStatusTextColor(status),
                                            ),
                                          ),
                                          if (status == 'pending')
                                            Text(
                                              'Организатор проверяет ваш отчёт',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                    if (rating != null)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFFF8E1),
                                          borderRadius: BorderRadius.circular(20),
                                          border: Border.all(
                                            color: const Color(0xFFFFC107),
                                            width: 1.5,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            const Icon(Icons.star, color: Color(0xFFFFC107), size: 18),
                                            const SizedBox(width: 4),
                                            Text(
                                              '$rating',
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFFF57C00),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                                if (status == 'approved' && organizerComment.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  Divider(color: Colors.grey[300]),
                                  const SizedBox(height: 8),
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFF4CAF50).withValues(alpha: 0.3)),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Row(
                                          children: [
                                            Icon(Icons.chat_bubble_outline, size: 16, color: Color(0xFF4CAF50)),
                                            SizedBox(width: 6),
                                            Text(
                                              'Комментарий организатора:',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF2E7D32),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          organizerComment,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            color: Colors.black87,
                                            height: 1.4,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                                if (status == 'rejected' && rejectionReason.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  Divider(color: Colors.grey[300]),
                                  const SizedBox(height: 8),
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFEBEE),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFF44336).withValues(alpha: 0.3)),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Row(
                                          children: [
                                            Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFF44336)),
                                            SizedBox(width: 6),
                                            Text(
                                              'Причина отклонения:',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFFC62828),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          rejectionReason,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            color: Colors.black87,
                                            height: 1.4,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        }

                        // Если фотоотчёта нет, показываем кнопку отправки
                        return Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () => _showSubmitPhotoReportDialog(task),
                            icon: const Icon(Icons.photo_camera, size: 20),
                            label: const Text('Отправить фотоотчет'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2196F3),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 2,
                            ),
                          ),
                        );
                      },
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: _getTaskAvailabilityColor(task),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _getTaskAvailabilityIcon(task),
                          color: Colors.white,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _getTaskAvailabilityText(task),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
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
        },
      ),
    );
  }

  Widget _buildProfileTab() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFE8F5E8),
            Color(0xFFF1F8E9),
            Color(0xFFFFFFFF),
          ],
        ),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const SizedBox(height: 20),
            // Аватар и имя
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.green.withValues(alpha: 0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Новый красивый аватар
                  FutureBuilder<Map<String, dynamic>?>(
                    future: _getUserProfile(),
                    builder: (context, snapshot) {
                      final userName = snapshot.data?['name'] ?? 'Волонтёр';
                      
                      return AppAvatar(
                        name: userName,
                        size: 80,
                        showBorder: true,
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  FutureBuilder<Map<String, dynamic>?>(
                    future: _getUserProfile(),
                    builder: (context, snapshot) {
                      final userName = snapshot.data?['name'] ?? 'Волонтёр';
                      final rating = snapshot.data?['rating'] ?? 0;

                      return Column(
                        children: [
                          Text(
                            userName,
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2E7D32),
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFC107),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.star, color: Colors.white, size: 18),
                                const SizedBox(width: 6),
                                Text(
                                  'Рейтинг: $rating',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Достижения
            _buildAchievementsSection(),

            const SizedBox(height: 24),

            // Последняя активность
            _buildActivitySection(),

            const SizedBox(height: 24),

            // Статистика (компактный дизайн - 3 карточки)
            Row(
              children: [
                Expanded(
                  child: _buildCompactStatCard(
                    'Проекты',
                    context.watch<VolunteerProjectsProvider>().projects.where((p) => p.isJoined).length.toString(),
                    Icons.folder_open,
                    const Color(0xFF4CAF50),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildCompactStatCard(
                    'Задачи',
                    context.watch<VolunteerTasksProvider>().tasks.where((t) => t.isAssigned).length.toString(),
                    Icons.task_alt,
                    const Color(0xFF2196F3),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildCompactStatCard(
                    'Фото',
                    context.watch<PhotoReportsProvider>().photoReports.length.toString(),
                    Icons.photo_camera,
                    const Color(0xFFFF9800),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 32),

            // 📊 Детальная статистика с динамикой рейтинга
            const UserStatsWidget(),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  // Компактная карточка статистики (меньше размер)
  Widget _buildCompactStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            color.withValues(alpha: 0.1),
            color.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: color,
            size: 24,
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey[700],
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildAchievementsSection() {
    final achievementsProvider = context.watch<AchievementsProvider>();

    if (achievementsProvider.isLoading) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.green.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    final achievements = achievementsProvider.achievements;

    // Показываем хотя бы 2 достижения (последнее разблокированное и первое заблокированное)
    final unlockedAchievements = achievements.where((a) => a.isUnlocked).toList()
      ..sort((a, b) => b.requiredRating.compareTo(a.requiredRating)); // Сортируем по убыванию рейтинга
    final lockedAchievements = achievements.where((a) => !a.isUnlocked).toList()
      ..sort((a, b) => a.requiredRating.compareTo(b.requiredRating)); // Сортируем по возрастанию рейтинга

    final currentUnlocked = unlockedAchievements.isNotEmpty
        ? unlockedAchievements.first // Берем последнее разблокированное (с наибольшим рейтингом)
        : null;

    return FutureBuilder<Map<String, dynamic>?>(
      future: _getUserProfile(),
      builder: (context, snapshot) {
        final rating = snapshot.data?['rating'] ?? 0;

        // Определяем следующее достижение на основе рейтинга
        Achievement? nextAchievement;
        int nextRatingThreshold = 100; // По умолчанию 100 для "Помощник"
        int currentRatingThreshold = 0; // Порог текущего уровня

        // Находим следующее заблокированное достижение
        final sortedLockedAchievements = lockedAchievements
          ..sort((a, b) => a.requiredRating.compareTo(b.requiredRating));

        if (sortedLockedAchievements.isNotEmpty) {
          nextAchievement = sortedLockedAchievements.first;
          nextRatingThreshold = nextAchievement.requiredRating;

          // Находим порог текущего уровня (последнее разблокированное достижение)
          final sortedUnlockedAchievements = unlockedAchievements
            ..sort((a, b) => b.requiredRating.compareTo(a.requiredRating));

          if (sortedUnlockedAchievements.isNotEmpty) {
            currentRatingThreshold = sortedUnlockedAchievements.first.requiredRating;
          }
        }

        // Вычисляем прогресс на основе рейтинга между уровнями
        double ratingProgress = 0.0;
        int ratingRange = nextRatingThreshold - currentRatingThreshold;
        int ratingInCurrentRange = rating - currentRatingThreshold;

        if (ratingRange > 0) {
          ratingProgress = (ratingInCurrentRange / ratingRange).clamp(0.0, 1.0);
        }

        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.green.withValues(alpha: 0.1),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Достижения',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF2E7D32),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        PageTransitions.scale(const AchievementsGalleryScreen()),
                      );
                    },
                    icon: const Icon(Icons.grid_view, size: 18),
                    label: const Text('Все'),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF4CAF50),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Достижения
              Row(
                children: [
                  Expanded(
                    child: currentUnlocked != null
                        ? _buildAchievementBadge(
                            title: currentUnlocked.name,
                            xp: '+${currentUnlocked.xp} XP',
                            isUnlocked: true,
                            icon: Icons.star,
                            color: const Color(0xFFFFC107),
                          )
                        : _buildAchievementBadge(
                            title: 'Новичок',
                            xp: '+100 XP',
                            isUnlocked: true,
                            icon: Icons.star,
                            color: const Color(0xFFFFC107),
                          ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: nextAchievement != null
                        ? _buildAchievementBadge(
                            title: nextAchievement.name,
                            xp: '????',
                            isUnlocked: false,
                            icon: Icons.lock,
                            color: Colors.grey,
                          )
                        : _buildAchievementBadge(
                            title: 'Помощник',
                            xp: '????',
                            isUnlocked: false,
                            icon: Icons.lock,
                            color: Colors.grey,
                          ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Прогресс
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      nextAchievement != null
                          ? 'Прогресс до "${nextAchievement.name}"'
                          : 'Прогресс до следующего уровня',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ),
                  Text(
                    nextAchievement != null
                        ? '$rating/$nextRatingThreshold'
                        : '$rating',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF4CAF50),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: LinearProgressIndicator(
                  value: ratingProgress,
                  minHeight: 8,
                  backgroundColor: Colors.grey[200],
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF4CAF50)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAchievementBadge({
    required String title,
    required String xp,
    required bool isUnlocked,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isUnlocked ? const Color(0xFFFFF9E6) : Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isUnlocked ? const Color(0xFFFFC107) : Colors.grey.shade300,
          width: 2,
        ),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            size: 40,
            color: color,
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: isUnlocked ? const Color(0xFFF57C00) : Colors.grey[600],
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            xp,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isUnlocked ? const Color(0xFF4CAF50) : Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivitySection() {
    final activityProvider = context.watch<ActivityProvider>();

    if (activityProvider.isLoading) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.green.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    final activities = activityProvider.getRecentActivities(3);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.green.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Последняя активность',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF2E7D32),
            ),
          ),
          const SizedBox(height: 16),
          if (activities.isEmpty)
            const Center(
              child: Text(
                'Нет активности',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
            )
          else
            ...activities.asMap().entries.map((entry) {
              final index = entry.key;
              final activity = entry.value;
              return Column(
                children: [
                  if (index > 0) const SizedBox(height: 12),
                  _buildActivityItem(
                    icon: _getActivityIcon(activity.type),
                    iconColor: _getActivityColor(activity.type),
                    title: activity.title,
                    description: activity.description,
                    timeAgo: activity.timeAgo,
                  ),
                ],
              );
            }).toList(),
        ],
      ),
    );
  }

  IconData _getActivityIcon(String type) {
    switch (type) {
      case 'task_completed':
        return Icons.check_circle;
      case 'project_joined':
        return Icons.group_add;
      case 'photo_uploaded':
        return Icons.photo_camera;
      case 'achievement_unlocked':
        return Icons.emoji_events; // Трофей для достижений
      default:
        return Icons.info;
    }
  }

  Color _getActivityColor(String type) {
    switch (type) {
      case 'task_completed':
        return const Color(0xFF4CAF50);
      case 'project_joined':
        return const Color(0xFF2196F3);
      case 'photo_uploaded':
        return const Color(0xFFFF9800);
      case 'achievement_unlocked':
        return const Color(0xFFFFC107); // Золотой для достижений
      default:
        return Colors.grey;
    }
  }

  Widget _buildActivityItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String description,
    required String timeAgo,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            icon,
            color: iconColor,
            size: 24,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$description • $timeAgo',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // 📅 NEW: Вкладка Календарь
  Widget _buildCalendarTab() {
    return const CalendarScreen();
  }
}