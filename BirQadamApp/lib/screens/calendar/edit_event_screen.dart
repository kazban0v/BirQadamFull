// lib/screens/edit_event_screen.dart
/// Экран редактирования события

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/calendar_provider.dart';
import '../../models/calendar_event.dart';

class EditEventScreen extends StatefulWidget {
  final CalendarEvent event;

  const EditEventScreen({super.key, required this.event});

  @override
  State<EditEventScreen> createState() => _EditEventScreenState();
}

class _EditEventScreenState extends State<EditEventScreen> {
  final _formKey = GlobalKey<FormState>();
  
  late TextEditingController _titleController;
  late TextEditingController _descriptionController;
  late TextEditingController _locationController;
  
  late DateTime _startDate;
  TimeOfDay? _startTime;
  DateTime? _endDate;
  TimeOfDay? _endTime;
  
  late String _eventType;
  late bool _isAllDay;
  int? _reminderMinutes;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    
    _titleController = TextEditingController(text: widget.event.title);
    _descriptionController = TextEditingController(text: widget.event.description);
    _locationController = TextEditingController(text: widget.event.location);
    
    _startDate = widget.event.startDate;
    _endDate = widget.event.endDate;
    _eventType = widget.event.eventType;
    _isAllDay = widget.event.isAllDay;
    _reminderMinutes = widget.event.reminderMinutes;
    
    // Парсинг времени начала
    if (widget.event.startTime != null && !_isAllDay) {
      final parts = widget.event.startTime!.split(':');
      if (parts.length >= 2) {
        _startTime = TimeOfDay(
          hour: int.parse(parts[0]),
          minute: int.parse(parts[1]),
        );
      }
    }
    
    // Парсинг времени окончания
    if (widget.event.endTime != null && !_isAllDay) {
      final parts = widget.event.endTime!.split(':');
      if (parts.length >= 2) {
        _endTime = TimeOfDay(
          hour: int.parse(parts[0]),
          minute: int.parse(parts[1]),
        );
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Редактировать'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Название
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Название *',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.title),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Введите название';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Тип события
            DropdownButtonFormField<String>(
              initialValue: _eventType,
              decoration: const InputDecoration(
                labelText: 'Тип события',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.category),
              ),
              items: const [
                DropdownMenuItem(value: 'custom', child: Text('📅 Свое событие')),
                DropdownMenuItem(value: 'meeting', child: Text('👥 Встреча')),
                DropdownMenuItem(value: 'reminder', child: Text('🔔 Напоминание')),
                DropdownMenuItem(value: 'project_start', child: Text('🚀 Начало проекта')),
                DropdownMenuItem(value: 'project_end', child: Text('🎯 Завершение проекта')),
                DropdownMenuItem(value: 'task_deadline', child: Text('⏰ Дедлайн задачи')),
              ],
              onChanged: (value) {
                if (value != null) {
                  setState(() => _eventType = value);
                }
              },
            ),
            const SizedBox(height: 16),

            // Описание
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Описание',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.description),
              ),
              maxLines: 4,
            ),
            const SizedBox(height: 16),

            // Дата начала
            ListTile(
              leading: const Icon(Icons.calendar_today),
              title: const Text('Дата начала *'),
              subtitle: Text(
                  '${_startDate.day}.${_startDate.month}.${_startDate.year}'),
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
              onTap: _selectStartDate,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: Colors.grey[400]!),
              ),
            ),
            const SizedBox(height: 16),

            // Весь день
            SwitchListTile(
              title: const Text('Весь день'),
              value: _isAllDay,
              onChanged: (value) {
                setState(() {
                  _isAllDay = value;
                  if (value) {
                    _startTime = null;
                    _endTime = null;
                  }
                });
              },
            ),

            // Время начала
            if (!_isAllDay) ...[
              ListTile(
                leading: const Icon(Icons.access_time),
                title: const Text('Время начала'),
                subtitle: Text(_startTime != null
                    ? '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}'
                    : 'Выберите время'),
                trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: _selectStartTime,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(color: Colors.grey[400]!),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Дата окончания
            ListTile(
              leading: const Icon(Icons.event),
              title: const Text('Дата окончания'),
              subtitle: Text(_endDate != null
                  ? '${_endDate!.day}.${_endDate!.month}.${_endDate!.year}'
                  : 'Не указано'),
              trailing: _endDate != null
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () => setState(() => _endDate = null),
                    )
                  : const Icon(Icons.arrow_forward_ios, size: 16),
              onTap: _selectEndDate,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: Colors.grey[400]!),
              ),
            ),
            const SizedBox(height: 16),

            // Место
            TextFormField(
              controller: _locationController,
              decoration: const InputDecoration(
                labelText: 'Место',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.location_on),
              ),
            ),
            const SizedBox(height: 16),

            // Напоминание
            DropdownButtonFormField<int?>(
              initialValue: _reminderMinutes,
              decoration: const InputDecoration(
                labelText: 'Напоминание',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.notifications),
              ),
              items: const [
                DropdownMenuItem(value: null, child: Text('Без напоминания')),
                DropdownMenuItem(value: 15, child: Text('За 15 минут')),
                DropdownMenuItem(value: 30, child: Text('За 30 минут')),
                DropdownMenuItem(value: 60, child: Text('За 1 час')),
                DropdownMenuItem(value: 1440, child: Text('За 1 день')),
              ],
              onChanged: (value) {
                setState(() => _reminderMinutes = value);
              },
            ),
            const SizedBox(height: 24),

            // Кнопка сохранения
            ElevatedButton(
              onPressed: _isLoading ? null : _updateEvent,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
              ),
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Сохранить'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _selectStartDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      locale: const Locale('ru'),
    );
    
    if (date != null) {
      setState(() => _startDate = date);
    }
  }

  Future<void> _selectStartTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: _startTime ?? TimeOfDay.now(),
    );
    
    if (time != null) {
      setState(() => _startTime = time);
    }
  }

  Future<void> _selectEndDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _endDate ?? _startDate,
      firstDate: _startDate,
      lastDate: DateTime(2030),
      locale: const Locale('ru'),
    );
    
    if (date != null) {
      setState(() => _endDate = date);
    }
  }

  Future<void> _updateEvent() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isLoading = true);

    final provider = Provider.of<CalendarProvider>(context, listen: false);

    // Формат времени
    String? startTimeStr;
    if (_startTime != null && !_isAllDay) {
      startTimeStr = '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}:00';
    }

    String? endTimeStr;
    if (_endTime != null && !_isAllDay) {
      endTimeStr = '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}:00';
    }

    final success = await provider.updateEvent(
      eventId: widget.event.id,
      title: _titleController.text.trim(),
      description: _descriptionController.text.trim(),
      eventType: _eventType,
      startDate: _startDate,
      startTime: startTimeStr,
      endDate: _endDate,
      endTime: endTimeStr,
      isAllDay: _isAllDay,
      location: _locationController.text.trim(),
      reminderMinutes: _reminderMinutes,
    );

    setState(() => _isLoading = false);

    if (mounted) {
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Событие обновлено')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('❌ Ошибка обновления')),
        );
      }
    }
  }
}





