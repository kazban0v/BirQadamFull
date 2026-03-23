import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../services/notifications/notification_service.dart';
import '../../config/app_config.dart';  // NEW: для профиля
import '../../widgets/common/skeleton_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/specialized/pull_to_refresh.dart';
import '../../widgets/specialized/user_stats_widget.dart';  // 📊 NEW: Статистика пользователя
import '../other/photo_reports_tab.dart';
import '../calendar/calendar_screen.dart';  // 📅 NEW: Календарь событий
import '../calendar/create_event_screen.dart';  // 📅 NEW: Создание событий
import '../settings/settings_screen.dart';  // ⚙️ NEW: Настройки
import '../chat/chats_list_screen.dart';  // 💬 NEW: Чаты
import '../../services/api/api_service.dart';
import '../../providers/auth_provider.dart';
import '../../providers/photo_reports_provider.dart';
import '../../providers/theme_provider.dart';  // 🌙 NEW: Темная тема
import '../../providers/user_stats_provider.dart';  // 📊 NEW: Провайдер статистики
import '../../providers/chat_provider.dart';  // 💬 NEW: Провайдер чатов
import '../error/error_screen.dart';

// Модель проекта для организатора
class OrganizerProject {
  final int id;
  final String title;
  final String description;
  final String city;
  final String status;
  final int volunteerCount;
  final int taskCount;
  final String createdAt;

  OrganizerProject({
    required this.id,
    required this.title,
    required this.description,
    required this.city,
    required this.status,
    required this.volunteerCount,
    required this.taskCount,
    required this.createdAt,
  });

  factory OrganizerProject.fromJson(Map<String, dynamic> json) {
    return OrganizerProject(
      id: int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      city: json['city'] ?? '',
      status: json['status'] ?? '',
      volunteerCount: int.tryParse(json['volunteer_count'].toString()) ?? 0,
      taskCount: int.tryParse(json['task_count'].toString()) ?? 0,
      createdAt: json['created_at'] ?? '',
    );
  }
}

// Модель участника проекта
class ProjectParticipant {
  final int id;
  final String name;
  final String email;
  final int rating;
  final String joinedAt;
  final int completedTasks;
  final int totalTasks;

  ProjectParticipant({
    required this.id,
    required this.name,
    required this.email,
    required this.rating,
    required this.joinedAt,
    required this.completedTasks,
    required this.totalTasks,
  });

  factory ProjectParticipant.fromJson(Map<String, dynamic> json) {
    return ProjectParticipant(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      rating: json['rating'] ?? 0,
      joinedAt: json['joined_at'] ?? '',
      completedTasks: json['completed_tasks'] ?? 0,
      totalTasks: json['total_tasks'] ?? 0,
    );
  }
}

class OrganizerPage extends StatefulWidget {
   const OrganizerPage({super.key});

   @override
   State<OrganizerPage> createState() => _OrganizerPageState();
 }

class _OrganizerPageState extends State<OrganizerPage> {
   int _selectedIndex = 0;
   List<OrganizerProject> _projects = [];
   bool _isLoadingProjects = false;
   String? _projectsError;

   @override
   void initState() {
     super.initState();
     _loadTokenAndData();
     _setupNotificationListener();
   }

  // ✅ ИСПРАВЛЕНИЕ: Добавлен listener для автоматического обновления при получении уведомлений
  void _setupNotificationListener() {
    // Слушаем foreground сообщения напрямую через FirebaseMessaging
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final data = message.data;
      final type = data['type'];
      
      print('📱 Organizer page: Получено FCM сообщение, тип: $type');
      
      // Если получено уведомление о новом фото - обновляем список фотоотчетов
      if (type == 'photo_report_submitted') {
        print('📱 Organizer page: Получено уведомление о фото, обновляем список...');
        // Обновляем список фотоотчетов через провайдер
        if (mounted) {
          final photoReportsProvider = Provider.of<PhotoReportsProvider>(context, listen: false);
          photoReportsProvider.loadPhotoReports();
        }
      }
      
      // Если получено уведомление о новом задании - обновляем список проектов
      if (type == 'task_assigned') {
        print('📱 Organizer page: Получено уведомление о задании, обновляем список...');
        _loadProjects();
      }
    });
  }

  Future<void> _loadTokenAndData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final token = authProvider.token;
    if (token != null && token.isNotEmpty) {
      // Отправляем FCM токен на сервер при загрузке сохраненного токена
      print('🔐 Organizer page: Sending FCM token to server');
      await NotificationService().setAuthToken(token);
      _loadProjects();
    } else {
      print('⚠️ Organizer page: No auth token available');
    }
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

  Future<void> _loadProjects() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final token = authProvider.token;
    if (token == null || token.isEmpty) return;

    setState(() {
      _isLoadingProjects = true;
      _projectsError = null;
    });

    try {
      // Получаем проекты текущего организатора
      final response = await http.get(
        Uri.parse(ApiService.organizerProjectsUrl),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _projects = (data as List)
              .map((project) => OrganizerProject.fromJson(project))
              .toList();
          _projectsError = null;
        });
      } else {
        print('Ошибка загрузки проектов: ${response.statusCode}');
        setState(() {
          _projectsError = 'Ошибка загрузки проектов (${response.statusCode})';
        });
      }
    } catch (e) {
      print('Ошибка загрузки проектов: $e');
      setState(() {
        _projectsError = 'Ошибка подключения: $e';
      });
    } finally {
      setState(() {
        _isLoadingProjects = false;
      });
    }
  }

  Future<List<ProjectParticipant>> _loadProjectParticipants(int projectId) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final token = authProvider.token;
    if (token == null || token.isEmpty) return [];

    try {
      final response = await http.get(
        Uri.parse(ApiService.projectParticipantsUrl(projectId)),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['participants'] as List)
            .map((participant) => ProjectParticipant.fromJson(participant))
            .toList();
      } else {
        print('Ошибка загрузки участников: ${response.statusCode}');
        return [];
      }
    } catch (e) {
      print('Ошибка загрузки участников: $e');
      return [];
    }
  }

  Future<bool> _updateProject(int projectId, Map<String, dynamic> projectData) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final token = authProvider.token;
    if (token == null || token.isEmpty) return false;

    try {
      final response = await http.put(
        Uri.parse(ApiService.projectManageUrl(projectId)),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(projectData),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Проект обновлен успешно'),
            backgroundColor: Colors.green,
          ),
        );
        return true;
      } else {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['error'] ?? 'Ошибка при обновлении проекта'),
            backgroundColor: Colors.red,
          ),
        );
        return false;
      }
    } catch (e) {
      print('Ошибка обновления проекта: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Ошибка подключения к серверу'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }
  }

  Future<bool> _deleteProject(int projectId) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final token = authProvider.token;
    if (token == null || token.isEmpty) return false;

    try {
      final response = await http.delete(
        Uri.parse(ApiService.projectManageUrl(projectId)),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Проект удален успешно'),
            backgroundColor: Colors.green,
          ),
        );
        return true;
      } else {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['error'] ?? 'Ошибка при удалении проекта'),
            backgroundColor: Colors.red,
          ),
        );
        return false;
      }
    } catch (e) {
      print('Ошибка удаления проекта: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Ошибка подключения к серверу'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
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
          const PhotoReportsTab(),
          _buildCalendarTab(), // 📅 Календарь
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
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.business),
            activeIcon: Icon(Icons.business, color: Color(0xFF4CAF50)),
            label: 'Проекты',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.photo_library_outlined),
            activeIcon: Icon(Icons.photo_library, color: Color(0xFF4CAF50)),
            label: 'Фотоотчеты',
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
            icon: Icon(Icons.person_outline_rounded),
            activeIcon: Icon(Icons.person_rounded, color: Color(0xFF4CAF50)),
            label: 'Профиль',
          ),
        ],
      ),
      // ✨ FAB для создания проектов/событий
      floatingActionButton: _selectedIndex == 0 || _selectedIndex == 2
          ? FloatingActionButton.extended(
              heroTag: _selectedIndex == 0 ? 'createProjectFAB' : 'createEventFAB', // Уникальный тег
              onPressed: () {
                if (_selectedIndex == 0) {
                  // Открываем полноэкранную форму создания проекта
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      fullscreenDialog: true,
                      builder: (context) => Scaffold(
                        appBar: AppBar(
                          title: const Text(
                            'Создать проект',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          backgroundColor: const Color(0xFF4CAF50),
                          foregroundColor: Colors.white,
                          elevation: 0,
                        ),
                        body: _buildCreateProjectTab(),
                      ),
                    ),
                  );
                } else if (_selectedIndex == 2) {
                  // Открываем экран создания события
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => CreateEventScreen(
                        initialDate: DateTime.now(),
                      ),
                    ),
                  );
                }
              },
              backgroundColor: const Color(0xFF4CAF50),
              foregroundColor: Colors.white,
              icon: Icon(_selectedIndex == 0 ? Icons.add_business : Icons.event_available),
              label: Text(
                _selectedIndex == 0 ? 'Создать проект' : 'Создать событие',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              elevation: 8,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            )
          : null,
    );
  }

  Widget _buildProjectsTab() {
    if (_isLoadingProjects) {
      return const ListSkeleton(
        itemSkeleton: ProjectCardSkeleton(),
        itemCount: 3,
      );
    }

    // Проверяем ошибки сети перед показом пустого состояния
    if (_projectsError != null && _projects.isEmpty) {
      final error = _projectsError!.toLowerCase();
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
            onRetry: () => _loadProjects(),
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
                  _projectsError!,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () => _loadProjects(),
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

    if (_projects.isEmpty) {
      return AppPullToRefresh(
        onRefresh: _loadProjects,
        child: ListView(
          children: [
            const SizedBox(height: 100),
            EmptyState(
              icon: Icons.folder_open,
              title: 'У вас пока нет проектов',
              message: 'Создайте первый проект через форму регистрации или обратитесь к администратору',
            ),
          ],
        ),
      );
    }

    return AppPullToRefresh(
      onRefresh: _loadProjects,
      child: ListView.builder(
        itemCount: _projects.length,
        itemBuilder: (context, index) {
          final project = _projects[index];
          return Card(
            margin: const EdgeInsets.all(8),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          project.title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: project.status == 'approved' 
                              ? Colors.green 
                              : project.status == 'rejected'
                                  ? Colors.red
                                  : Colors.orange,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          project.status == 'approved' 
                              ? 'Одобрен' 
                              : project.status == 'rejected'
                                  ? 'Отклонен'
                                  : 'Ожидание',
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(project.description),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.location_on, size: 16, color: Colors.grey),
                      Text(' ${project.city}'),
                      const SizedBox(width: 16),
                      Icon(Icons.group, size: 16, color: Colors.blue),
                      Text(' ${project.volunteerCount} волонтеров'),
                      const SizedBox(width: 16),
                      Icon(Icons.task, size: 16, color: Colors.orange),
                      Text(' ${project.taskCount} задач'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _buildActionButton(
                                onPressed: () => _showProjectManagementDialog(project),
                                label: 'Управлять проектом',
                                icon: Icons.settings,
                                color: const Color(0xFF2196F3),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildActionButton(
                                onPressed: () => _showProjectParticipantsDialog(project),
                                label: 'Участники',
                                icon: Icons.group,
                                color: const Color(0xFF4CAF50),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: _buildActionButton(
                            onPressed: () => _showCreateTaskDialog(project),
                            label: 'Создать задачу',
                            icon: Icons.add_task,
                            color: const Color(0xFFFF9800),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCreateProjectTab() {
    final _titleController = TextEditingController();
    final _descriptionController = TextEditingController();
    final _cityController = TextEditingController();
    double? _latitude;
    double? _longitude;
    bool _isGettingLocation = false;
    bool _isCreating = false;
    String _volunteerType = 'environmental'; // Default type

    return StatefulBuilder(
      builder: (context, setState) {
        return Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFF0F7FF), // Светло-голубой
                Color(0xFFFFF5F5), // Светло-розовый
                Color(0xFFF5FFF0), // Светло-зелёный
                Color(0xFFFFFFFF),
              ],
              stops: [0.0, 0.3, 0.6, 1.0],
            ),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Заголовок с анимацией
                TweenAnimationBuilder<double>(
                  tween: Tween<double>(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 800),
                  builder: (context, value, child) {
                    return Opacity(
                      opacity: value,
                      child: Transform.translate(
                        offset: Offset(0, 20 * (1 - value)),
                        child: child,
                      ),
                    );
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                        padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Color(0xFF1976D2), // Синий
                              Color(0xFF42A5F5), // Светло-синий
                            ],
                          ),
                          borderRadius: BorderRadius.circular(24),
                              boxShadow: [
                                BoxShadow(
                              color: const Color(0xFF1976D2).withValues(alpha: 0.4),
                              blurRadius: 20,
                              offset: const Offset(0, 10),
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.3),
                                  width: 2,
                                ),
                            ),
                            child: const Icon(
                                Icons.rocket_launch_rounded,
                              color: Colors.white,
                                size: 36,
                            ),
                          ),
                            const SizedBox(width: 20),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Создание нового проекта',
                                  style: TextStyle(
                                      fontSize: 26,
                                    fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      letterSpacing: 0.5,
                                  ),
                                ),
                                  const SizedBox(height: 6),
                                Text(
                                  'Заполните информацию о вашем экологическом проекте',
                                  style: TextStyle(
                                      fontSize: 13,
                                      color: Colors.white.withValues(alpha: 0.9),
                                      fontWeight: FontWeight.w400,
                                      height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),

                // Форма с анимированными карточками
                TweenAnimationBuilder<double>(
                  tween: Tween<double>(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 1000),
                  builder: (context, value, child) {
                    return Opacity(
                      opacity: value,
                      child: Transform.translate(
                        offset: Offset(0, 30 * (1 - value)),
                        child: child,
                      ),
                    );
                  },
                  child: Column(
                    children: [
                      // Название проекта
                      _buildAnimatedInputCard(
                        controller: _titleController,
                        label: 'Название проекта',
                        hint: 'Введите привлекательное название',
                        icon: Icons.title,
                        maxLines: 1,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Название обязательно';
                          }
                          if (value.length < 3) {
                            return 'Минимум 3 символа';
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 20),

                      // Описание проекта
                      _buildAnimatedInputCard(
                        controller: _descriptionController,
                        label: 'Описание проекта',
                        hint: 'Расскажите о цели и задачах проекта',
                        icon: Icons.description,
                        maxLines: 4,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Описание обязательно';
                          }
                          if (value.length < 10) {
                            return 'Минимум 10 символов';
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 20),

                      // Город
                      _buildAnimatedInputCard(
                        controller: _cityController,
                        label: 'Город',
                        hint: 'Город проведения проекта',
                        icon: Icons.location_city,
                        maxLines: 1,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Город обязателен';
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 20),

                      // Выбор типа волонтерства
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFFF9800).withValues(alpha: 0.15),
                              blurRadius: 24,
                              offset: const Offset(0, 12),
                            ),
                          ],
                          border: Border.all(
                            color: const Color(0xFFFF9800).withValues(alpha: 0.2),
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFFFF9800), Color(0xFFFFB74D)],
                                    ),
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFFF9800).withValues(alpha: 0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.category_rounded,
                                    color: Colors.white,
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                const Text(
                                  'Тип волонтерства',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 18),
                            DropdownButtonFormField<String>(
                              initialValue: _volunteerType,
                              decoration: InputDecoration(
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: Color(0xFFFF9800)),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: Color(0xFFFF9800)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: Color(0xFFFF9800), width: 2),
                                ),
                                filled: true,
                                fillColor: const Color(0xFFFFF5F7),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                              ),
                              items: const [
                                DropdownMenuItem(
                                  value: 'social',
                                  child: Row(
                                    children: [
                                      Icon(Icons.volunteer_activism, color: Color(0xFFE91E63), size: 20),
                                      SizedBox(width: 8),
                                      Text('Социальная помощь'),
                                    ],
                                  ),
                                ),
                                DropdownMenuItem(
                                  value: 'environmental',
                                  child: Row(
                                    children: [
                                      Icon(Icons.eco, color: Color(0xFF4CAF50), size: 20),
                                      SizedBox(width: 8),
                                      Text('Экологические проекты'),
                                    ],
                                  ),
                                ),
                                DropdownMenuItem(
                                  value: 'cultural',
                                  child: Row(
                                    children: [
                                      Icon(Icons.theater_comedy, color: Color(0xFF9C27B0), size: 20),
                                      SizedBox(width: 8),
                                      Text('Культурные мероприятия'),
                                    ],
                                  ),
                                ),
                              ],
                              onChanged: (value) {
                                if (value != null) {
                                  setState(() {
                                    _volunteerType = value;
                                  });
                                }
                              },
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Геолокация с красивым дизайном
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF4CAF50).withValues(alpha: 0.2),
                              blurRadius: 24,
                              offset: const Offset(0, 12),
                            ),
                          ],
                          border: Border.all(
                            color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF4CAF50), Color(0xFF81C784)],
                                    ),
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.location_on_rounded,
                                    color: Colors.white,
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                const Text(
                                  'Геолокация проекта',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            if (_latitude != null && _longitude != null) ...[
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE8F5E8),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.check_circle,
                                      color: Color(0xFF4CAF50),
                                      size: 24,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Геолокация получена',
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF2E7D32),
                                            ),
                                          ),
                                          Text(
                                            'Широта: ${_latitude!.toStringAsFixed(6)}\nДолгота: ${_longitude!.toStringAsFixed(6)}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey[600],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ] else ...[
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.orange[50],
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: Colors.orange[300]!,
                                    width: 1.5,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.warning_amber_rounded,
                                      color: Colors.orange[700],
                                      size: 24,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Геолокация не установлена',
                                            style: TextStyle(
                                              color: Colors.orange[900],
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Обязательно! Нажмите кнопку для получения.',
                                            style: TextStyle(
                                              color: Colors.orange[700],
                                              fontSize: 11,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 18),
                            Container(
                              width: double.infinity,
                              height: 56,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF4CAF50), Color(0xFF81C784)],
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                ),
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF4CAF50).withValues(alpha: 0.4),
                                    blurRadius: 12,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: ElevatedButton.icon(
                                onPressed: _isGettingLocation
                                    ? null
                                    : () async {
                                        setState(() {
                                          _isGettingLocation = true;
                                        });

                                        try {
                                          // Проверяем, включена ли служба геолокации
                                          bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
                                          if (!serviceEnabled) {
                                            setState(() {
                                              _isGettingLocation = false;
                                            });
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(
                                                content: Text('Включите службу геолокации в настройках устройства'),
                                                backgroundColor: Colors.orange,
                                                duration: Duration(seconds: 4),
                                              ),
                                            );
                                            return;
                                          }

                                          // Проверяем разрешение
                                          LocationPermission permission = await Geolocator.checkPermission();
                                          if (permission == LocationPermission.denied) {
                                            permission = await Geolocator.requestPermission();
                                            if (permission == LocationPermission.denied) {
                                              setState(() {
                                                _isGettingLocation = false;
                                              });
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                const SnackBar(
                                                  content: Text('Разрешение на геолокацию отклонено. Попробуйте ещё раз.'),
                                                  backgroundColor: Colors.red,
                                                  duration: Duration(seconds: 3),
                                                ),
                                              );
                                              return;
                                            }
                                          }

                                          if (permission == LocationPermission.deniedForever) {
                                            setState(() {
                                              _isGettingLocation = false;
                                            });
                                            // Показываем полноценный экран ошибки вместо простого сообщения
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) => ErrorScreens.noLocation(
                                                  onClose: () => Navigator.pop(context),
                                                ),
                                              ),
                                            );
                                            return;
                                          }

                                          // Сначала пробуем получить последнюю известную позицию (для эмулятора)
                                          Position? position;
                                          try {
                                            position = await Geolocator.getLastKnownPosition();
                                            if (position != null) {
                                              print('✅ Получена последняя известная позиция');
                                            }
                                          } catch (e) {
                                            print('⚠️ Не удалось получить последнюю позицию: $e');
                                          }

                                          // Если нет последней позиции, получаем текущую
                                          if (position == null) {
                                            position = await Geolocator.getCurrentPosition(
                                              desiredAccuracy: LocationAccuracy.low,
                                              forceAndroidLocationManager: true, // Для эмулятора
                                            ).timeout(
                                              const Duration(seconds: 30),
                                              onTimeout: () {
                                                throw TimeoutException('Таймаут');
                                              },
                                            );
                                          }
                                          
                                          // Позиция получена, используем её
                                          final currentPosition = position;
                                          setState(() {
                                            _latitude = currentPosition.latitude;
                                            _longitude = currentPosition.longitude;
                                            _isGettingLocation = false;
                                          });

                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('✓ Геолокация получена успешно!'),
                                              backgroundColor: Colors.green,
                                              duration: Duration(seconds: 2),
                                            ),
                                          );
                                        } on TimeoutException catch (_) {
                                          print('Таймаут получения геолокации');
                                          setState(() {
                                            _isGettingLocation = false;
                                          });
                                          // Показываем экран ошибки геолокации
                                          if (context.mounted) {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) => ErrorScreens.noLocation(
                                                  onClose: () => Navigator.pop(context),
                                                ),
                                              ),
                                            );
                                          }
                                        } catch (e) {
                                          print('Ошибка получения геолокации: $e');
                                          setState(() {
                                            _isGettingLocation = false;
                                          });

                                          // Проверяем, это ошибка разрешения или другая ошибка
                                          final errorString = e.toString().toLowerCase();
                                          if (errorString.contains('permission') || 
                                              errorString.contains('разрешение') ||
                                              errorString.contains('denied')) {
                                            // Если это проблема с разрешением, проверяем статус
                                            final permission = await Geolocator.checkPermission();
                                            if (permission == LocationPermission.deniedForever) {
                                              if (context.mounted) {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (_) => ErrorScreens.noLocation(
                                                      onClose: () => Navigator.pop(context),
                                                    ),
                                                  ),
                                                );
                                              }
                                              return;
                                            }
                                          }

                                          // Для других ошибок показываем экран ошибки геолокации
                                          if (context.mounted) {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) => ErrorScreens.noLocation(
                                                  onClose: () => Navigator.pop(context),
                                                ),
                                              ),
                                            );
                                          }
                                        }
                                      },
                                icon: _isGettingLocation
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Icon(Icons.my_location_rounded, size: 22),
                                label: Text(
                                  _isGettingLocation ? 'Получение...' : 'Получить геолокацию',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.transparent,
                                  foregroundColor: Colors.white,
                                  shadowColor: Colors.transparent,
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  elevation: 0,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 32),

                      // Кнопка создания с анимацией
                      TweenAnimationBuilder<double>(
                        tween: Tween<double>(begin: 0, end: 1),
                        duration: const Duration(milliseconds: 1200),
                        builder: (context, value, child) {
                          return Opacity(
                            opacity: value,
                            child: Transform.translate(
                              offset: Offset(0, 20 * (1 - value)),
                              child: child,
                            ),
                          );
                        },
                        child: Container(
                          width: double.infinity,
                          height: 64,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF4CAF50), Color(0xFF81C784)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF4CAF50).withValues(alpha: 0.5),
                                blurRadius: 20,
                                offset: const Offset(0, 10),
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: ElevatedButton(
                            onPressed: _isCreating ? null : () async {
                              // Валидация полей
                              String? titleError = _titleController.text.isEmpty ? 'Название обязательно' :
                                                 _titleController.text.length < 3 ? 'Минимум 3 символа' : null;
                              String? descError = _descriptionController.text.isEmpty ? 'Описание обязательно' :
                                                _descriptionController.text.length < 10 ? 'Минимум 10 символов' : null;
                              String? cityError = _cityController.text.isEmpty ? 'Город обязателен' : null;

                              if (titleError != null || descError != null || cityError != null) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(titleError ?? descError ?? cityError ?? 'Заполните все поля'),
                                    backgroundColor: Colors.red,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                );
                                return;
                              }

                              // Проверка геолокации (обязательно!)
                              if (_latitude == null || _longitude == null) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Row(
                                      children: const [
                                        Icon(Icons.location_off, color: Colors.white),
                                        SizedBox(width: 12),
                                        Expanded(
                                          child: Text(
                                            'Геолокация обязательна! Нажмите кнопку "Получить геолокацию"',
                                            style: TextStyle(fontSize: 14),
                                          ),
                                        ),
                                      ],
                                    ),
                                    backgroundColor: Colors.orange[700],
                                    duration: const Duration(seconds: 4),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                );
                                return;
                              }

                              setState(() {
                                _isCreating = true;
                              });


                              try {
                                final authProvider = Provider.of<AuthProvider>(context, listen: false);
                                final token = authProvider.token;

                                if (token == null || token.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: const Text('Ошибка авторизации. Пожалуйста, войдите снова'),
                                      backgroundColor: Colors.red,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                  return;
                                }

                                final requestData = {
                                  'title': _titleController.text,
                                  'description': _descriptionController.text,
                                  'city': _cityController.text,
                                  'volunteer_type': _volunteerType,
                                };

                                if (_latitude != null && _longitude != null) {
                                  requestData['latitude'] = _latitude.toString();
                                  requestData['longitude'] = _longitude.toString();
                                }

                                print('🔍 Creating project with token: ${token.substring(0, 50)}...');

                                final response = await http.post(
                                  Uri.parse(ApiService.organizerProjectsUrl),
                                  headers: {
                                    'Authorization': 'Bearer $token',
                                    'Content-Type': 'application/json',
                                  },
                                  body: jsonEncode(requestData),
                                );

                                if (response.statusCode == 201) {
                                  final data = jsonDecode(response.body);
                                  
                                  // Закрываем форму
                                  Navigator.of(context).pop();
                                  
                                  // Показываем уведомление об успехе
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(data['message'] ?? 'Проект создан успешно!'),
                                        backgroundColor: Colors.green,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                      ),
                                    );
                                    
                                    // Перезагрузить проекты
                                    await _loadProjects();
                                  }
                                } else {
                                  final data = jsonDecode(response.body);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(data['error'] ?? 'Ошибка при создании проекта'),
                                        backgroundColor: Colors.red,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                      ),
                                    );
                                  }
                                }
                              } catch (e) {
                                print('Ошибка создания проекта: $e');
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: const Text('Ошибка подключения к серверу'),
                                      backgroundColor: Colors.red,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } finally {
                                setState(() {
                                  _isCreating = false;
                                });
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            child: _isCreating
                                ? const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 3,
                                        ),
                                      ),
                                      SizedBox(width: 16),
                                      Text(
                                        'Создание...',
                                        style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.rocket_launch_rounded, size: 26, color: Colors.white),
                                      SizedBox(width: 12),
                                      Text(
                                        'Создать проект',
                                        style: TextStyle(
                                          fontSize: 19,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAnimatedInputCard({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    required int maxLines,
    required String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.green.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
        border: Border.all(
          color: const Color(0xFF4CAF50).withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          labelStyle: const TextStyle(
            color: Color(0xFF4CAF50),
            fontWeight: FontWeight.w600,
          ),
          hintStyle: TextStyle(
            color: Colors.grey[400],
            fontSize: 14,
          ),
          prefixIcon: Container(
            padding: const EdgeInsets.all(12),
            child: Icon(
              icon,
              color: const Color(0xFF4CAF50),
              size: 24,
            ),
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          enabledBorder: OutlineInputBorder(
            borderSide: BorderSide.none,
            borderRadius: BorderRadius.circular(16),
          ),
          focusedBorder: OutlineInputBorder(
            borderSide: const BorderSide(
              color: Color(0xFF4CAF50),
              width: 2,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          errorBorder: OutlineInputBorder(
            borderSide: const BorderSide(
              color: Colors.red,
              width: 1,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderSide: const BorderSide(
              color: Colors.red,
              width: 2,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        style: const TextStyle(
          color: Color(0xFF2E7D32),
          fontSize: 16,
        ),
      ),
    );
  }

  void _showProjectManagementDialog(OrganizerProject project) {
    final titleController = TextEditingController(text: project.title);
    final descriptionController = TextEditingController(text: project.description);
    final cityController = TextEditingController(text: project.city);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
        elevation: 0,
        backgroundColor: Colors.transparent,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.92,
          constraints: const BoxConstraints(maxHeight: 700),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 30,
                offset: const Offset(0, 15),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Современный заголовок с градиентом
              Container(
                padding: const EdgeInsets.all(24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFFFF6B35), Color(0xFFFF8C5A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        // Иконка с эффектом
                    Container(
                          padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.3),
                              width: 2,
                            ),
                      ),
                      child: const Icon(
                            Icons.edit_note_rounded,
                        color: Colors.white,
                            size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Управление проектом',
                            style: TextStyle(
                              color: Colors.white,
                                  fontSize: 22,
                              fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                            ),
                          ),
                              const SizedBox(height: 4),
                          Text(
                                project.title.length > 35 ? '${project.title.substring(0, 35)}...' : project.title,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                                maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                        // Кнопка закрытия
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => Navigator.pop(context),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                        color: Colors.white,
                        size: 24,
                              ),
                            ),
                      ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Содержимое с анимацией
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Заголовок секции
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Row(
                          children: [
                      Container(
                              width: 4,
                              height: 20,
                        decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFFF6B35), Color(0xFFFF8C5A)],
                                ),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 12),
                            const Text(
                              'Информация о проекте',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2D3748),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Название проекта
                      _buildModernTextField(
                        controller: titleController,
                        label: 'Название проекта',
                        icon: Icons.title_rounded,
                        color: const Color(0xFFFF6B35),
                      ),
                      const SizedBox(height: 16),

                      // Описание проекта
                      _buildModernTextField(
                          controller: descriptionController,
                        label: 'Описание проекта',
                        icon: Icons.description_rounded,
                        color: const Color(0xFFFF6B35),
                          maxLines: 4,
                      ),
                      const SizedBox(height: 16),

                      // Город
                      _buildModernTextField(
                          controller: cityController,
                        label: 'Город',
                        icon: Icons.location_city_rounded,
                        color: const Color(0xFFFF6B35),
                      ),
                      const SizedBox(height: 24),

                      // Статистика проекта
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              const Color(0xFFFF6B35).withValues(alpha: 0.1),
                              const Color(0xFFFF8C5A).withValues(alpha: 0.05),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: const Color(0xFFFF6B35).withValues(alpha: 0.2),
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                const Icon(
                                  Icons.analytics_rounded,
                                  color: Color(0xFFFF6B35),
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Статистика проекта',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2D3748),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildModernStatCard(
                                    '${project.volunteerCount}',
                                    'Волонтеров',
                                    Icons.people_rounded,
                                    const Color(0xFF1976D2),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildModernStatCard(
                                    '${project.taskCount}',
                                    'Задач',
                                    Icons.task_alt_rounded,
                                    const Color(0xFF4CAF50),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            _buildModernStatCard(
                              project.status == 'approved' ? 'Одобрен' : 'На проверке',
                              'Статус',
                              project.status == 'approved' ? Icons.check_circle_rounded : Icons.schedule_rounded,
                              project.status == 'approved' ? const Color(0xFF4CAF50) : const Color(0xFFFF6B35),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Кнопки действий
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(28),
                    bottomRight: Radius.circular(28),
                  ),
                  border: Border(
                    top: BorderSide(
                      color: Colors.grey[200]!,
                      width: 1,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    // Кнопка "Отмена"
                    Expanded(
                      child: _buildActionButton(
                        onPressed: () => Navigator.pop(context),
                        label: 'Отмена',
                        icon: Icons.close_rounded,
                        color: Colors.grey[600]!,
                        isOutlined: true,
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Кнопка "Сохранить"
                    Expanded(
                      child: _buildActionButton(
                        onPressed: () async {
                          if (titleController.text.trim().isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Введите название проекта')),
                            );
                            return;
                          }

                          final success = await _updateProject(project.id, {
                            'title': titleController.text.trim(),
                            'description': descriptionController.text.trim(),
                            'city': cityController.text.trim(),
                          });

                          if (success) {
                            Navigator.pop(context);
                            _loadProjects();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Проект успешно обновлен!')),
                            );
                          }
                        },
                        label: 'Сохранить',
                        icon: Icons.check_rounded,
                        color: const Color(0xFF4CAF50),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Кнопка "Удалить"
                    Expanded(
                      child: _buildActionButton(
                        onPressed: () async {
                          final confirmed = await showDialog<bool>(
                            context: context,
                            builder: (context) => Dialog(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(24),
                              ),
                              child: Container(
                                padding: const EdgeInsets.all(24),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(24),
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                      padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: Colors.red.withValues(alpha: 0.1),
                                        shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                        Icons.warning_rounded,
                                      color: Colors.red,
                                        size: 48,
                                    ),
                                  ),
                                    const SizedBox(height: 20),
                                  const Text(
                                      'Удалить проект?',
                                    style: TextStyle(
                                        fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                        color: Color(0xFF2D3748),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    const Text(
                                      'Это действие нельзя отменить. Все данные проекта будут удалены безвозвратно.',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 15,
                                        color: Color(0xFF718096),
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
                                              padding: const EdgeInsets.symmetric(vertical: 14),
                                              side: BorderSide(color: Colors.grey[300]!),
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(12),
                                              ),
                                            ),
                                  child: const Text(
                                    'Отмена',
                                              style: TextStyle(
                                                color: Color(0xFF718096),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Container(
                                            decoration: BoxDecoration(
                                              gradient: const LinearGradient(
                                                colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                                              ),
                                              borderRadius: BorderRadius.circular(12),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: Colors.red.withValues(alpha: 0.3),
                                                  blurRadius: 8,
                                                  offset: const Offset(0, 4),
                                                ),
                                              ],
                                            ),
                                            child: ElevatedButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  style: ElevatedButton.styleFrom(
                                                backgroundColor: Colors.transparent,
                                    foregroundColor: Colors.white,
                                                padding: const EdgeInsets.symmetric(vertical: 14),
                                                shadowColor: Colors.transparent,
                                    shape: RoundedRectangleBorder(
                                                  borderRadius: BorderRadius.circular(12),
                                                ),
                                              ),
                                              child: const Text(
                                                'Удалить',
                                                style: TextStyle(fontWeight: FontWeight.w600),
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

                          if (confirmed == true) {
                            final success = await _deleteProject(project.id);
                            if (success) {
                              Navigator.pop(context);
                              _loadProjects();
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Проект успешно удален')),
                              );
                            }
                          }
                        },
                        label: 'Удалить',
                        icon: Icons.delete_rounded,
                        color: Colors.red,
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

  // Helper методы для современного дизайна диалогов
  
  Widget _buildModernTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required Color color,
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withValues(alpha: 0.2),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
              ),
            ],
          ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        style: const TextStyle(
          color: Color(0xFF2D3748),
          fontSize: 15,
          fontWeight: FontWeight.w500,
        ),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(
            color: color,
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
          prefixIcon: Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.2), color.withValues(alpha: 0.1)],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              color: color,
              size: 20,
            ),
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.all(16),
          floatingLabelBehavior: FloatingLabelBehavior.auto,
        ),
      ),
    );
  }

  Widget _buildModernStatCard(String value, String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withValues(alpha: 0.2),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
      children: [
        Container(
            padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, color.withValues(alpha: 0.8)],
              ),
              borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            icon,
              color: Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
        Text(
          value,
          style: const TextStyle(
                    fontSize: 18,
            fontWeight: FontWeight.bold,
                    color: Color(0xFF2D3748),
          ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
        ),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
                    color: Color(0xFF718096),
                    fontWeight: FontWeight.w500,
          ),
          maxLines: 1,
          overflow: TextOverflow.visible,
          softWrap: false,
        ),
      ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required VoidCallback onPressed,
    required String label,
    required IconData icon,
    required Color color,
    bool isOutlined = false,
  }) {
    if (isOutlined) {
      return OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 18),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          foregroundColor: color,
          side: BorderSide(color: color.withValues(alpha: 0.3), width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, color.withValues(alpha: 0.85)],
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 18),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }

  void _showProjectParticipantsDialog(OrganizerProject project) async {
    final participants = await _loadProjectParticipants(project.id);

    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
        child: Container(
          width: MediaQuery.of(context).size.width * 0.95,
          height: MediaQuery.of(context).size.height * 0.8,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            color: Colors.white,
          ),
          child: Column(
            children: [
              // Заголовок с градиентом
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF1976D2), Color(0xFF42A5F5)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: Column(
                  children: [
              Row(
                children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.people_rounded,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 12),
                  Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                      'Участники',
                                style: TextStyle(
                                  fontSize: 22,
                        fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                project.title.length > 30 ? '${project.title.substring(0, 30)}...' : project.title,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.white.withValues(alpha: 0.9),
                                  fontWeight: FontWeight.w500,
                      ),
                      overflow: TextOverflow.ellipsis,
                              ),
                            ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                  ),
                ],
              ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Список участников
              Expanded(
                child: participants.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.group_off,
                              size: 64,
                              color: Colors.grey[400],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Пока нет участников',
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: participants.length,
                        itemBuilder: (context, index) {
                          final participant = participants[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFF1976D2).withValues(alpha: 0.2), width: 1.5),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF1976D2).withValues(alpha: 0.1),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
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
                                        gradient: const LinearGradient(
                                          colors: [Color(0xFF1976D2), Color(0xFF42A5F5)],
                                        ),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Icon(
                                        Icons.person_rounded,
                                        color: Colors.white,
                                        size: 20,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        participant.name.length > 20
                                            ? '${participant.name.substring(0, 20)}...'
                                            : participant.name,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Color(0xFF2D3436),
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        gradient: const LinearGradient(
                                          colors: [Color(0xFFFF9800), Color(0xFFFFB74D)],
                                        ),
                                        borderRadius: BorderRadius.circular(12),
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFFFF9800).withValues(alpha: 0.3),
                                            blurRadius: 4,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.star_rounded, color: Colors.white, size: 14),
                                          const SizedBox(width: 4),
                                          Text(
                                        '${participant.rating}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                              fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.email_rounded,
                                      color: Colors.grey[600],
                                      size: 16,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        participant.email.length > 25
                                            ? '${participant.email.substring(0, 25)}...'
                                            : participant.email,
                                        style: TextStyle(
                                          color: Colors.grey[600],
                                          fontSize: 13,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        'Присоединился: ${participant.joinedAt.split(' ')[0]}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF2E7D32),
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Text(
                                      'Задачи: ${participant.completedTasks}/${participant.totalTasks}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF2E7D32),
                                        fontWeight: FontWeight.w500,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),

              // Статистика
              if (participants.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E8),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      Expanded(
                        child: Column(
                          children: [
                            Text(
                              participants.length.toString(),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2E7D32),
                              ),
                            ),
                            const Text(
                              'Участников',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF4CAF50),
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Text(
                              participants.fold<int>(0, (sum, p) => sum + p.completedTasks).toString(),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2E7D32),
                              ),
                            ),
                            const Text(
                              'Выполнено задач',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF4CAF50),
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Text(
                              (participants.fold<double>(0, (sum, p) => sum + p.rating) / participants.length).toStringAsFixed(1),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2E7D32),
                              ),
                            ),
                            const Text(
                              'Средний рейтинг',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF4CAF50),
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
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

  void _showCreateTaskDialog(OrganizerProject project) {
    final textController = TextEditingController();
    DateTime? selectedDeadline;
    TimeOfDay? selectedStartTime;
    TimeOfDay? selectedEndTime;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          elevation: 0,
          backgroundColor: Colors.transparent,
          child: Container(
            width: MediaQuery.of(context).size.width * 0.92,
            constraints: const BoxConstraints(maxHeight: 700),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 30,
                  offset: const Offset(0, 15),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Заголовок с градиентом
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(28),
                      topRight: Radius.circular(28),
                    ),
                  ),
                  child: Row(
                    children: [
                Container(
                        padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.3),
                            width: 2,
                          ),
                        ),
                        child: const Icon(
                          Icons.add_task_rounded,
                          color: Colors.white,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 16),
                      const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                            Text(
                              'Создать задачу',
                        style: TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                          fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Добавьте новую задачу для проекта',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => Navigator.pop(context),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.close_rounded,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Содержимое
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Описание задачи
                        _buildModernTextField(
                          controller: textController,
                          label: 'Описание задачи *',
                          icon: Icons.description_rounded,
                          color: const Color(0xFF4CAF50),
                          maxLines: 3,
                        ),
                        const SizedBox(height: 20),

                        // Дедлайн задачи
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () async {
                              final DateTime? picked = await showDatePicker(
                                context: context,
                                initialDate: selectedDeadline ?? DateTime.now(),
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now().add(const Duration(days: 365)),
                                builder: (context, child) {
                                  return Theme(
                                    data: Theme.of(context).copyWith(
                                      colorScheme: const ColorScheme.light(
                                        primary: Color(0xFF4CAF50),
                                        onPrimary: Colors.white,
                                        surface: Colors.white,
                                        onSurface: Colors.black,
                                      ),
                                    ),
                                    child: child!,
                                  );
                                },
                              );
                              if (picked != null) {
                                setState(() {
                                  selectedDeadline = picked;
                                });
                              }
                            },
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(18),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: const Color(0xFF4CAF50).withValues(alpha: 0.2),
                                  width: 1.5,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF4CAF50).withValues(alpha: 0.08),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                              child: Row(
                                children: [
                Container(
                                    padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [const Color(0xFF4CAF50).withValues(alpha: 0.2), const Color(0xFF4CAF50).withValues(alpha: 0.1)],
                                      ),
                    borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(
                                      Icons.calendar_today_rounded,
                                      color: Color(0xFF4CAF50),
                                      size: 22,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                          'Дедлайн задачи',
                                  style: TextStyle(
                                    fontSize: 12,
                                            color: Color(0xFF718096),
                                            fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                        Text(
                                          selectedDeadline != null
                                              ? '${selectedDeadline!.day}.${selectedDeadline!.month}.${selectedDeadline!.year}'
                                              : 'Выберите дату',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w600,
                                            color: selectedDeadline != null ? const Color(0xFF2D3748) : const Color(0xFF718096),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Icon(
                                    Icons.arrow_forward_ios_rounded,
                                    color: Color(0xFF4CAF50),
                                    size: 16,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Время выполнения
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Container(
                                width: 4,
                                height: 16,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
                                  ),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              const SizedBox(width: 12),
                              const Text(
                                'Время выполнения',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2D3748),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Row(
                          children: [
                            // Время начала
                            Expanded(
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () async {
                                    final TimeOfDay? picked = await showTimePicker(
                                      context: context,
                                      initialTime: selectedStartTime ?? TimeOfDay.now(),
                                      builder: (context, child) {
                                        return Theme(
                                          data: Theme.of(context).copyWith(
                                            colorScheme: const ColorScheme.light(
                                              primary: Color(0xFF4CAF50),
                                              onPrimary: Colors.white,
                                              surface: Colors.white,
                                              onSurface: Colors.black,
                                            ),
                                          ),
                                          child: child!,
                                        );
                                      },
                                    );
                                    if (picked != null) {
                                      setState(() {
                                        selectedStartTime = picked;
                                      });
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(14),
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: const Color(0xFF4CAF50).withValues(alpha: 0.2),
                                        width: 1.5,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFF4CAF50).withValues(alpha: 0.06),
                                          blurRadius: 8,
                                          offset: const Offset(0, 3),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.access_time_rounded,
                                              color: const Color(0xFF4CAF50),
                                              size: 18,
                                            ),
                                            const SizedBox(width: 6),
                                            const Text(
                                              'Начало',
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Color(0xFF718096),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                            selectedStartTime != null
                                                ? selectedStartTime!.format(context)
                                              : '--:--',
                                            style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            color: selectedStartTime != null ? const Color(0xFF2D3748) : const Color(0xFF718096),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                            ),
                          ),
                          const SizedBox(width: 12),
                            // Время окончания
                          Expanded(
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () async {
                                    final TimeOfDay? picked = await showTimePicker(
                                      context: context,
                                      initialTime: selectedEndTime ?? TimeOfDay.now(),
                                      builder: (context, child) {
                                        return Theme(
                                          data: Theme.of(context).copyWith(
                                            colorScheme: const ColorScheme.light(
                                              primary: Color(0xFF4CAF50),
                                              onPrimary: Colors.white,
                                              surface: Colors.white,
                                              onSurface: Colors.black,
                                            ),
                                          ),
                                          child: child!,
                                        );
                                      },
                                    );
                                    if (picked != null) {
                                      setState(() {
                                        selectedEndTime = picked;
                                      });
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(14),
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: const Color(0xFF4CAF50).withValues(alpha: 0.2),
                                        width: 1.5,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: const Color(0xFF4CAF50).withValues(alpha: 0.06),
                                          blurRadius: 8,
                                          offset: const Offset(0, 3),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.access_time_filled_rounded,
                                              color: const Color(0xFF4CAF50),
                                              size: 18,
                                            ),
                                            const SizedBox(width: 6),
                                            const Text(
                                              'Окончание',
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Color(0xFF718096),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                            selectedEndTime != null
                                                ? selectedEndTime!.format(context)
                                              : '--:--',
                                            style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            color: selectedEndTime != null ? const Color(0xFF2D3748) : const Color(0xFF718096),
                                            ),
                                          ),
                                      ],
                                    ),
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
                // Кнопки действий
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.grey[50],
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(28),
                      bottomRight: Radius.circular(28),
                    ),
                    border: Border(
                      top: BorderSide(
                        color: Colors.grey[200]!,
                        width: 1,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      // Кнопка "Отмена"
                      Expanded(
                        child: _buildActionButton(
              onPressed: () => Navigator.pop(context),
                          label: 'Отмена',
                          icon: Icons.close_rounded,
                          color: Colors.grey[600]!,
                          isOutlined: true,
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Кнопка "Создать"
                      Expanded(
                        flex: 2,
                        child: _buildActionButton(
              onPressed: () async {
                            if (textController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Введите описание задачи')),
                  );
                  return;
                }

                // ✅ ИСПРАВЛЕНИЕ: Сохраняем контекст перед асинхронной операцией
                final navigator = Navigator.of(context);
                final scaffoldMessenger = ScaffoldMessenger.of(context);

                try {
                  final requestData = {
                                'text': textController.text.trim(),
                  };

                  // Добавляем дедлайн если выбран
                  if (selectedDeadline != null) {
                    requestData['deadline_date'] = selectedDeadline!.toIso8601String().split('T')[0];
                  }

                  // Добавляем время если выбрано
                  if (selectedStartTime != null) {
                    requestData['start_time'] = '${selectedStartTime!.hour.toString().padLeft(2, '0')}:${selectedStartTime!.minute.toString().padLeft(2, '0')}';
                  }
                  if (selectedEndTime != null) {
                    requestData['end_time'] = '${selectedEndTime!.hour.toString().padLeft(2, '0')}:${selectedEndTime!.minute.toString().padLeft(2, '0')}';
                  }

                  final authProvider = Provider.of<AuthProvider>(context, listen: false);
                  final token = authProvider.token;
                  if (token == null || token.isEmpty) {
                    scaffoldMessenger.showSnackBar(
                      const SnackBar(content: Text('Ошибка авторизации')),
                    );
                    return;
                  }

                  final response = await http.post(
                    Uri.parse(ApiService.projectTasksUrl(project.id)),
                    headers: {
                      'Authorization': 'Bearer $token',
                      'Content-Type': 'application/json',
                    },
                    body: jsonEncode(requestData),
                  );

                  if (response.statusCode == 201) {
                    final data = jsonDecode(response.body);
                                navigator.pop();
                                // ✅ ИСПРАВЛЕНИЕ: Обновляем список проектов после создания задачи
                                _loadProjects();
                    scaffoldMessenger.showSnackBar(
                      SnackBar(
                        content: Text(data['message'] ?? 'Задача создана успешно!'),
                        backgroundColor: Colors.green,
                      ),
                    );
                  } else {
                    final data = jsonDecode(response.body);
                    scaffoldMessenger.showSnackBar(
                      SnackBar(
                        content: Text(data['error'] ?? 'Ошибка при создании задачи'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                } catch (e) {
                  print('Ошибка создания задачи: $e');
                  scaffoldMessenger.showSnackBar(
                    const SnackBar(
                      content: Text('Ошибка подключения к серверу'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
                          label: 'Создать задачу',
                          icon: Icons.add_task_rounded,
                          color: const Color(0xFF4CAF50),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Вкладка "Профиль" с аналитикой и графиками
  Widget _buildProfileTab() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF0F7FF),
            Color(0xFFFFF5F5),
            Color(0xFFFFFFFF),
          ],
        ),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),
            
            // 👤 Профиль организатора (аватар, имя, email)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.blue.withValues(alpha: 0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Аватар
                  FutureBuilder<Map<String, dynamic>?>(
                    future: _getUserProfile(),
                    builder: (context, snapshot) {
                      final userName = snapshot.data?['name'] ?? 'Организатор';
                      
                      return Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF1976D2), Color(0xFF42A5F5)],
                          ),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF1976D2).withValues(alpha: 0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Text(
                            userName.isNotEmpty ? userName[0].toUpperCase() : 'О',
                            style: const TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  // Имя и email
                  FutureBuilder<Map<String, dynamic>?>(
                    future: _getUserProfile(),
                    builder: (context, snapshot) {
                      final userName = snapshot.data?['name'] ?? 'Организатор';
                      final email = snapshot.data?['email'] ?? 'email@example.com';

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            userName,
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1565C0),
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            email,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[600],
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1976D2),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.business_center, color: Colors.white, size: 18),
                                SizedBox(width: 6),
                                Text(
                                  'Организатор',
                                  style: TextStyle(
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

            // 📊 Реальная статистика с динамикой рейтинга
            const UserStatsWidget(),

            const SizedBox(height: 32),

            // Недавние проекты
            _buildSectionTitle('Недавние проекты'),

            const SizedBox(height: 16),

            ..._projects.take(3).map((project) => _buildRecentProjectCard(project)),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 24,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1976D2), Color(0xFF42A5F5)],
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Color(0xFF2D3436),
          ),
        ),
      ],
    );
  }

  Widget _buildRecentProjectCard(OrganizerProject project) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1976D2), Color(0xFF42A5F5)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.folder_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  project.title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2D3436),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.people, size: 14, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Text(
                      '${project.volunteerCount} волонтёров',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(Icons.task_alt, size: 14, color: Colors.grey[600]),
                    const SizedBox(width: 4),
                    Text(
                      '${project.taskCount} задач',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: project.status == 'approved'
                  ? const Color(0xFF4CAF50).withValues(alpha: 0.15)
                  : project.status == 'active'
                      ? const Color(0xFF2196F3).withValues(alpha: 0.15)
                      : project.status == 'completed'
                          ? const Color(0xFF1976D2).withValues(alpha: 0.15)
                          : const Color(0xFFFF9800).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              project.status == 'approved'
                  ? 'Одобрен'
                  : project.status == 'active'
                      ? 'Активный'
                      : project.status == 'completed'
                          ? 'Завершён'
                          : 'Ожидание',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: project.status == 'approved'
                    ? const Color(0xFF4CAF50)
                    : project.status == 'active'
                        ? const Color(0xFF2196F3)
                        : project.status == 'completed'
                            ? const Color(0xFF1976D2)
                            : const Color(0xFFFF9800),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 📅 NEW: Вкладка Календарь для организатора (с возможностью создания событий)
  Widget _buildCalendarTab() {
    return Stack(
      children: [
        const CalendarScreen(),
        // FloatingActionButton для создания событий
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton.extended(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CreateEventScreen(
                    initialDate: DateTime.now(),
                  ),
                ),
              );
            },
            icon: const Icon(Icons.add),
            label: const Text('Создать'),
            backgroundColor: const Color(0xFF4CAF50),
            foregroundColor: Colors.white,
          ),
        ),
      ],
    );
  }
}