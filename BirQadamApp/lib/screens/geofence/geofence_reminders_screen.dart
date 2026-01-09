// lib/screens/geofence_reminders_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/geofence_provider.dart';
import '../../services/geofence/geofence_service.dart';

class GeofenceRemindersScreen extends StatefulWidget {
  const GeofenceRemindersScreen({super.key});

  @override
  State<GeofenceRemindersScreen> createState() => _GeofenceRemindersScreenState();
}

class _GeofenceRemindersScreenState extends State<GeofenceRemindersScreen> {
  bool _isMonitoring = false;

  @override
  void initState() {
    super.initState();
    _isMonitoring = GeofenceService().isMonitoring;
    // Загружаем напоминания после первого фрейма
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadReminders();
    });
  }

  Future<void> _loadReminders() async {
    if (mounted) {
      await context.read<GeofenceProvider>().fetchReminders();
    }
  }

  Future<void> _toggleMonitoring() async {
    final provider = context.read<GeofenceProvider>();
    final service = GeofenceService();

    if (_isMonitoring) {
      service.stopMonitoring();
      setState(() => _isMonitoring = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('🛑 Мониторинг остановлен')),
        );
      }
    } else {
      await service.startMonitoring(provider);
      setState(() => _isMonitoring = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Мониторинг запущен')),
        );
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    final provider = context.watch<GeofenceProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('📍 Геонапоминания'),
        actions: [
          IconButton(
            icon: Icon(_isMonitoring ? Icons.pause_circle : Icons.play_circle),
            onPressed: _toggleMonitoring,
            tooltip: _isMonitoring ? 'Остановить' : 'Запустить',
          ),
        ],
      ),
      body: provider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : provider.reminders.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  itemCount: provider.reminders.length,
                  itemBuilder: (context, index) {
                    final reminder = provider.reminders[index];
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: reminder.isActive
                              ? Colors.green
                              : Colors.grey,
                          child: Icon(
                            reminder.isTriggered
                                ? Icons.check_circle
                                : Icons.location_on,
                            color: Colors.white,
                          ),
                        ),
                        title: Text(reminder.locationName),
                        subtitle: Text(
                          '${reminder.radiusDisplay} • ${reminder.isTriggered ? "Сработало" : reminder.isActive ? "Активно" : "Неактивно"}',
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete),
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (context) => AlertDialog(
                                title: const Text('Удалить?'),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(context, false),
                                    child: const Text('Отмена'),
                                  ),
                                  TextButton(
                                    onPressed: () => Navigator.pop(context, true),
                                    child: const Text('Удалить'),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed == true && mounted) {
                              await provider.deleteReminder(reminder.id);
                            }
                          },
                        ),
                      ),
                    );
                  },
                ),
      floatingActionButton: null,
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.location_off, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'Нет активных напоминаний',
            style: TextStyle(fontSize: 18, color: Colors.grey[600]),
          ),
          const SizedBox(height: 8),
          Text(
            'Присоединитесь к проекту с координатами,\nи напоминание создастся автоматически! 📍',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }
}

