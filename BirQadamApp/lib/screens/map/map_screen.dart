import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:ui' as ui;  // Для Path рисования
import '../../providers/map_provider.dart';
import '../../providers/volunteer_projects_provider.dart';
import '../../providers/volunteer_tasks_provider.dart';
import '../../providers/activity_provider.dart';
import '../../models/project_marker.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_text_styles.dart';
import '../../widgets/specialized/volunteer_type_badge.dart';
import '../../services/api/api_service.dart';
import '../../providers/auth_provider.dart';
import '../error/error_screen.dart';

/// Экран карты проектов
class MapScreen extends StatefulWidget {
  const MapScreen({Key? key}) : super(key: key);

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  LatLng _center = const LatLng(43.2220, 76.8512); // Алматы по умолчанию
  LatLng? _myLocation; // Моё местоположение
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    
    // Анимация пульсации для маркера местоположения
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MapProvider>().loadMarkers();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mapProvider = context.watch<MapProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('🗺️ Карта проектов'),
        actions: [
          // Кнопка фильтров
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.filter_list),
                onPressed: () => _showFilterDialog(context),
              ),
              if (mapProvider.hasActiveFilters)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      '${mapProvider.activeFiltersCount}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          // Кнопка геолокации
          IconButton(
            icon: const Icon(Icons.my_location),
            onPressed: _goToMyLocation,
          ),
        ],
      ),
      body: Stack(
        children: [
          // Карта
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 12.0,
              minZoom: 5.0,
              maxZoom: 18.0,
            ),
            children: [
              // Слой карты OpenStreetMap
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'kz.birqadam.cleanupv1',
                tileProvider: NetworkTileProvider(),
              ),

              // Маркеры проектов
              MarkerLayer(
                markers: [
                  // Маркеры проектов
                  ...mapProvider.markers.map((marker) {
                    return Marker(
                      point: LatLng(marker.latitude, marker.longitude),
                      width: 50,
                      height: 50,
                      alignment: Alignment.topCenter,
                      child: GestureDetector(
                        onTap: () => _showProjectInfo(context, marker),
                        child: Column(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: _getMarkerColor(marker.volunteerType),
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 3),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.3),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: Text(
                                  marker.volunteerTypeIcon,
                                  style: const TextStyle(fontSize: 20),
                                ),
                              ),
                            ),
                            // Маленький треугольник внизу
                            CustomPaint(
                              size: const Size(10, 6),
                              painter: _TrianglePainter(
                                color: _getMarkerColor(marker.volunteerType),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  
                  // Маркер "Вы здесь" (моё местоположение)
                  if (_myLocation != null)
                    Marker(
                      point: _myLocation!,
                      width: 80,
                      height: 80,
                      alignment: Alignment.center,
                      child: AnimatedBuilder(
                        animation: _pulseAnimation,
                        builder: (context, child) {
                          return Stack(
                            alignment: Alignment.center,
                            children: [
                              // Пульсирующий внешний круг
                              Opacity(
                                opacity: _pulseAnimation.value,
                                child: Container(
                                  width: 80 * _pulseAnimation.value,
                                  height: 80 * _pulseAnimation.value,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.blue.withValues(alpha: 0.2),
                                    border: Border.all(
                                      color: Colors.blue.withValues(alpha: 0.4),
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                              // Средний круг
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.blue.withValues(alpha: 0.3),
                                ),
                              ),
                              // Центральная точка
                              Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.blue,
                                  border: Border.all(color: Colors.white, width: 3),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.3),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                ],
              ),
            ],
          ),

          // Индикатор загрузки
          if (mapProvider.isLoading)
            Container(
              color: Colors.black.withValues(alpha: 0.3),
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),

          // Ошибка
          if (mapProvider.error != null)
            Positioned(
              top: 10,
              left: 10,
              right: 10,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error, color: Colors.white),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          mapProvider.error!,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white),
                        onPressed: () {
                          mapProvider.clearError();
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // Счетчик проектов
          Positioned(
            top: 10,
            left: 10,
            child: Material(
              elevation: 4,
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.place, color: AppColors.primary, size: 20),
                    const SizedBox(width: 6),
                    Text(
                      'Проектов: ${mapProvider.markers.length}',
                      style: AppTextStyles.cardSubtitle.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Определить цвет маркера по типу волонтерства
  Color _getMarkerColor(String type) {
    switch (type) {
      case 'environmental':
        return AppColors.success;
      case 'social':
        return AppColors.primary;
      case 'cultural':
        return AppColors.accent;
      default:
        return AppColors.textSecondary;
    }
  }

  /// Показать информацию о проекте
  void _showProjectInfo(BuildContext context, ProjectMarker marker) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Индикатор свайпа
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Заголовок
              Text(marker.title, style: AppTextStyles.h5),
              const SizedBox(height: 8),

              // Тип волонтерства
              VolunteerTypeBadge(
                volunteerTypeString: marker.volunteerType,
                showLabel: true,
              ),
              const SizedBox(height: 16),

              // Описание
              Text(marker.description, style: AppTextStyles.body),
              const SizedBox(height: 16),

              // Информация
              _buildInfoRow(Icons.location_city, marker.city),
              _buildInfoRow(
                Icons.person,
                'Организатор: ${marker.creatorName}',
              ),
              _buildInfoRow(
                Icons.people,
                '${marker.volunteersCount} ${_pluralizeVolunteers(marker.volunteersCount)}',
              ),
              if (marker.startDate != null)
                _buildInfoRow(
                  Icons.calendar_today,
                  'Начало: ${DateFormat('d MMMM yyyy', 'ru').format(marker.startDate!)}',
                ),

              const SizedBox(height: 20),

              // Кнопка действия
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: marker.isJoined
                      ? null
                      : () => _joinProject(context, marker.id),
                  icon: Icon(marker.isJoined ? Icons.check : Icons.add),
                  label: Text(
                    marker.isJoined ? 'Вы участвуете' : 'Присоединиться',
                  ),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Строка информации с иконкой
  Widget _buildInfoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: AppTextStyles.bodySecondary),
          ),
        ],
      ),
    );
  }

  /// Показать диалог фильтров
  void _showFilterDialog(BuildContext context) {
    final mapProvider = context.read<MapProvider>();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Фильтры'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Фильтр по типу
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Тип волонтерства',
                  border: OutlineInputBorder(),
                ),
                initialValue: mapProvider.selectedType,
                items: const [
                  DropdownMenuItem(value: null, child: Text('Все')),
                  DropdownMenuItem(
                    value: 'environmental',
                    child: Text('🌳 Экологические'),
                  ),
                  DropdownMenuItem(
                    value: 'social',
                    child: Text('🤝 Социальные'),
                  ),
                  DropdownMenuItem(
                    value: 'cultural',
                    child: Text('🎭 Культурные'),
                  ),
                ],
                onChanged: (value) {
                  mapProvider.setTypeFilter(value);
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        ),
        actions: [
          if (mapProvider.hasActiveFilters)
            TextButton(
              onPressed: () {
                mapProvider.clearFilters();
                Navigator.pop(context);
              },
              child: const Text('Сбросить'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Закрыть'),
          ),
        ],
      ),
    );
  }

  /// Переместить карту к текущей геолокации
  Future<void> _goToMyLocation() async {
    // Показываем индикатор загрузки
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
            SizedBox(width: 16),
            Text('Определяем ваше местоположение...'),
          ],
        ),
        duration: Duration(seconds: 10),
      ),
    );

    try {
      // Проверяем включена ли геолокация на устройстве
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        _showError('Включите геолокацию в настройках устройства');
        return;
      }

      // Проверяем разрешения
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          _showError('Предоставьте разрешение на доступ к геолокации');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
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

      // Получаем текущее местоположение
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      // Скрываем индикатор загрузки
      ScaffoldMessenger.of(context).hideCurrentSnackBar();

      // Сохраняем местоположение и обновляем UI
      setState(() {
        _myLocation = LatLng(position.latitude, position.longitude);
      });

      // Перемещаем карту
      _mapController.move(
        LatLng(position.latitude, position.longitude),
        15.0, // Увеличил zoom для лучшей видимости
      );

      // Показываем успешное сообщение
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('📍 Вы здесь! Синий маркер показывает ваше местоположение'),
              ),
            ],
          ),
          backgroundColor: AppColors.success,
          duration: const Duration(seconds: 3),
          action: SnackBarAction(
            label: 'ОК',
            textColor: Colors.white,
            onPressed: () {},
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      debugPrint('Geolocation error: $e');
      
      if (e.toString().contains('timeout')) {
        _showError('Не удалось определить местоположение. Проверьте GPS');
      } else {
        _showError('Ошибка геолокации. Убедитесь что GPS включен');
      }
    }
  }

  /// Показать ошибку
  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  /// Присоединиться к проекту
  Future<void> _joinProject(BuildContext context, int projectId) async {
    final authProvider = context.read<AuthProvider>();
    final token = authProvider.token;
    
    if (token == null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Требуется авторизация'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Проверяем ограничение: волонтер может присоединиться только к 1 проекту
    final projects = context.read<VolunteerProjectsProvider>().projects;
    final joinedProjectsCount = projects.where((p) => p.isJoined).length;
    if (joinedProjectsCount >= 1) {
      // Закрываем popup карты
      Navigator.pop(context);
      
      // Показываем предупреждение
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Вы можете участвовать только в одном проекте одновременно'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 4),
        ),
      );
      return;
    }

    // Показываем индикатор загрузки
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(),
      ),
    );

    try {
      final response = await http.post(
        Uri.parse(ApiService.projectJoinUrl(projectId)),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      // Закрываем индикатор загрузки
      if (mounted) Navigator.pop(context);
      
      // Закрываем popup карты
      if (mounted) Navigator.pop(context);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        
        // Обновляем данные
        if (mounted) {
          context.read<VolunteerProjectsProvider>().loadProjects();
          context.read<VolunteerTasksProvider>().loadTasks();
          context.read<ActivityProvider>().loadActivities();
          context.read<MapProvider>().loadMarkers(); // Обновляем маркеры карты
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.white),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(data['message'] ?? 'Вы присоединились к проекту!'),
                  ),
                ],
              ),
              backgroundColor: AppColors.success,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      } else {
        final data = jsonDecode(response.body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['error'] ?? 'Ошибка при присоединении'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      // Закрываем индикатор загрузки
      if (mounted) Navigator.pop(context);
      
      // Закрываем popup карты
      if (mounted) Navigator.pop(context);
      
      debugPrint('Ошибка присоединения к проекту: $e');
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ошибка подключения к серверу'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Плюрализация слова "волонтер"
  String _pluralizeVolunteers(int count) {
    if (count % 10 == 1 && count % 100 != 11) {
      return 'волонтер';
    } else if ([2, 3, 4].contains(count % 10) &&
        ![12, 13, 14].contains(count % 100)) {
      return 'волонтера';
    } else {
      return 'волонтеров';
    }
  }
}

/// Рисовальщик треугольника для маркера
class _TrianglePainter extends CustomPainter {
  final Color color;

  _TrianglePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = ui.Path()
      ..moveTo(size.width / 2, size.height) // Нижняя точка
      ..lineTo(0, 0) // Левая верхняя точка
      ..lineTo(size.width, 0) // Правая верхняя точка
      ..close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_TrianglePainter oldDelegate) => oldDelegate.color != color;
}

