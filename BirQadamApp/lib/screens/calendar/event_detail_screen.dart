// lib/screens/event_detail_screen.dart
/// Экран детальной информации о событии

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/calendar_provider.dart';
import '../../models/calendar_event.dart';
import 'edit_event_screen.dart';

class EventDetailScreen extends StatefulWidget {
  final int eventId;

  const EventDetailScreen({super.key, required this.eventId});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  CalendarEvent? _event;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadEventDetails();
  }

  Future<void> _loadEventDetails() async {
    setState(() => _isLoading = true);
    
    final provider = Provider.of<CalendarProvider>(context, listen: false);
    final event = await provider.getEventDetails(widget.eventId);
    
    setState(() {
      _event = event;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Загрузка...')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_event == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Ошибка')),
        body: const Center(child: Text('Событие не найдено')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_event!.typeIcon),
        actions: [
          if (_event!.canEdit)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: _editEvent,
            ),
          if (_event!.canEdit)
            IconButton(
              icon: const Icon(Icons.delete),
              onPressed: _deleteEvent,
            ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Заголовок
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: _event!.isPast ? Colors.grey[300] : Colors.blue[50],
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _event!.title,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _event!.eventTypeDisplay,
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[700],
                    ),
                  ),
                ],
              ),
            ),

            // Дата и время
            _buildSection(
              icon: Icons.calendar_today,
              title: 'Дата и время',
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('📅 ${_event!.formattedStartDate}'),
                  if (_event!.formattedTime != null)
                    Text('🕐 ${_event!.formattedTime}'),
                  if (_event!.endDate != null)
                    Text('До: ${_event!.endDate!.day}.${_event!.endDate!.month}.${_event!.endDate!.year}'),
                ],
              ),
            ),

            // Описание
            if (_event!.description.isNotEmpty)
              _buildSection(
                icon: Icons.description,
                title: 'Описание',
                content: Text(_event!.description),
              ),

            // Место
            if (_event!.location.isNotEmpty)
              _buildSection(
                icon: Icons.location_on,
                title: 'Место',
                content: Text(_event!.location),
              ),

            // Проект
            if (_event!.project != null)
              _buildSection(
                icon: Icons.business,
                title: 'Проект',
                content: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_event!.project!.title),
                    if (_event!.project!.city != null)
                      Text('📍 ${_event!.project!.city}'),
                  ],
                ),
              ),

            // Задача
            if (_event!.task != null)
              _buildSection(
                icon: Icons.task,
                title: 'Задача',
                content: Text(_event!.task!.text),
              ),

            // Участники
            _buildSection(
              icon: Icons.group,
              title: 'Участники (${_event!.participants.length})',
              content: _event!.participants.isEmpty
                  ? const Text('Пока нет участников')
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: _event!.participants
                          .map((p) => Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Row(
                                  children: [
                                    const Icon(Icons.person, size: 16),
                                    const SizedBox(width: 8),
                                    Text(p.username),
                                  ],
                                ),
                              ))
                          .toList(),
                    ),
            ),

            // Создатель
            _buildSection(
              icon: Icons.person_outline,
              title: 'Создатель',
              content: Text(_event!.creator.username),
            ),

            // Напоминание
            if (_event!.reminderMinutes != null)
              _buildSection(
                icon: Icons.notifications,
                title: 'Напоминание',
                content: Text(_getReminderText(_event!.reminderMinutes!)),
              ),

            const SizedBox(height: 80),
          ],
        ),
      ),
      bottomNavigationBar: _buildActionBar(),
    );
  }

  /// Секция с иконкой
  Widget _buildSection({
    required IconData icon,
    required String title,
    required Widget content,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.blue),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                content,
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Панель действий (кнопки присоединиться/покинуть)
  Widget? _buildActionBar() {
    // Не показывать если событие прошло или создатель
    if (_event!.isPast || _event!.canEdit) {
      return null;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: _event!.isParticipant
            ? ElevatedButton(
                onPressed: _leaveEvent,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.exit_to_app),
                    SizedBox(width: 8),
                    Text('Покинуть событие', style: TextStyle(fontSize: 16)),
                  ],
                ),
              )
            : ElevatedButton(
                onPressed: _joinEvent,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4CAF50),
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle),
                    SizedBox(width: 8),
                    Text('Присоединиться', style: TextStyle(fontSize: 16)),
                  ],
                ),
              ),
      ),
    );
  }

  /// Присоединиться к событию
  Future<void> _joinEvent() async {
    final provider = Provider.of<CalendarProvider>(context, listen: false);
    final success = await provider.joinEvent(widget.eventId);

    if (mounted) {
      if (success) {
        // ✅ ВАЖНО: Перезагрузить детали события чтобы обновить количество участников
        await _loadEventDetails();
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Вы присоединились к событию'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('❌ Ошибка при присоединении'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Покинуть событие
  Future<void> _leaveEvent() async {
    final provider = Provider.of<CalendarProvider>(context, listen: false);
    final success = await provider.leaveEvent(widget.eventId);

    if (mounted) {
      if (success) {
        // ✅ ВАЖНО: Перезагрузить детали события чтобы обновить количество участников
        await _loadEventDetails();
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Вы покинули событие'),
            backgroundColor: Colors.orange,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('❌ Ошибка при выходе'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Редактировать событие
  void _editEvent() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => EditEventScreen(event: _event!),
      ),
    ).then((_) => _loadEventDetails());
  }

  /// Удалить событие
  Future<void> _deleteEvent() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Удалить событие?'),
        content: const Text('Это действие нельзя отменить.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Отмена'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Удалить'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final provider = Provider.of<CalendarProvider>(context, listen: false);
      final success = await provider.deleteEvent(widget.eventId);

      if (mounted) {
        if (success) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('✅ Событие удалено')),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('❌ Ошибка')),
          );
        }
      }
    }
  }

  /// Текст напоминания
  String _getReminderText(int minutes) {
    if (minutes < 60) {
      return 'За $minutes минут';
    } else if (minutes < 1440) {
      final hours = minutes ~/ 60;
      return 'За $hours ${_pluralHours(hours)}';
    } else {
      final days = minutes ~/ 1440;
      return 'За $days ${_pluralDays(days)}';
    }
  }

  String _pluralHours(int hours) {
    if (hours == 1) return 'час';
    if (hours >= 2 && hours <= 4) return 'часа';
    return 'часов';
  }

  String _pluralDays(int days) {
    if (days == 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  }
}

