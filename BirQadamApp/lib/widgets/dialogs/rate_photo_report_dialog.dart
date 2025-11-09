import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/photo_report.dart';
import '../../providers/photo_reports_provider.dart';

class RatePhotoReportDialog extends StatefulWidget {
  final PhotoReport photoReport;

  const RatePhotoReportDialog({
    super.key,
    required this.photoReport,
  });

  @override
  State<RatePhotoReportDialog> createState() => _RatePhotoReportDialogState();
}

class _RatePhotoReportDialogState extends State<RatePhotoReportDialog> {
  int _selectedRating = 0;
  final TextEditingController _feedbackController = TextEditingController();
  bool _isSubmitting = false;
  bool _showCommentField = false;

  @override
  void dispose() {
    _feedbackController.dispose();
    super.dispose();
  }

  Future<void> _submitRating() async {
    if (_selectedRating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Выберите оценку'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Проверяем обязательность комментария для низких оценок
    if (_selectedRating <= 3 && _feedbackController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Комментарий обязателен для оценки 1-3 звезды'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final success = await context.read<PhotoReportsProvider>().ratePhotoReport(
        widget.photoReport.id,
        _selectedRating,
        _feedbackController.text.trim().isNotEmpty ? _feedbackController.text.trim() : null,
      );

      if (!mounted) return;

      if (success) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Фотоотчет успешно оценен!'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        final errorMessage = context.read<PhotoReportsProvider>().errorMessage;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage ?? 'Ошибка при оценке фотоотчета'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Ошибка: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      child: Container(
        width: MediaQuery.of(context).size.width * 0.9,
        constraints: const BoxConstraints(maxHeight: 500),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Заголовок
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFFFC107), Color(0xFFFFD54F)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.star,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Оценить фотоотчет',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Задача: "${widget.photoReport.taskText.length > 25 ? '${widget.photoReport.taskText.substring(0, 25)}...' : widget.photoReport.taskText}"',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          'Волонтёр: ${widget.photoReport.volunteerName}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                ],
              ),
            ),

            // Содержимое
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Звёзды рейтинга
                    const Text(
                      'Ваша оценка:',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF2E7D32),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(5, (index) {
                          final rating = index + 1;
                          return GestureDetector(
                            onTap: () {
                              setState(() {
                                _selectedRating = rating;
                                _showCommentField = true;
                              });
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Icon(
                                _selectedRating >= rating ? Icons.star : Icons.star_border,
                                color: _selectedRating >= rating
                                    ? const Color(0xFFFFC107)
                                    : const Color(0xFF9E9E9E),
                                size: 48,
                              ),
                            ),
                          );
                        }),
                      ),
                    ),

                    // Показываем поле комментария после выбора звёзд
                    if (_showCommentField) ...[
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          const Icon(Icons.comment, color: Color(0xFF4CAF50), size: 20),
                          const SizedBox(width: 8),
                          Text(
                            _selectedRating <= 3
                                ? 'Комментарий (обязательно):'
                                : 'Комментарий (опционально):',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: _selectedRating <= 3
                                  ? const Color(0xFFF44336)
                                  : const Color(0xFF2E7D32),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _feedbackController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: _selectedRating <= 3
                              ? 'Объясните причину низкой оценки...'
                              : 'Оставьте комментарий (опционально)...',
                          hintStyle: TextStyle(color: Colors.grey[400]),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: _selectedRating <= 3
                                  ? const Color(0xFFF44336)
                                  : const Color(0xFF4CAF50),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: _selectedRating <= 3
                                  ? const Color(0xFFF44336).withValues(alpha: 0.5)
                                  : Colors.grey[300]!,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(
                              color: _selectedRating <= 3
                                  ? const Color(0xFFF44336)
                                  : const Color(0xFF4CAF50),
                              width: 2,
                            ),
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF8F9FA),
                          contentPadding: const EdgeInsets.all(16),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (_selectedRating <= 3)
                        const Row(
                          children: [
                            Icon(Icons.info_outline, size: 16, color: Color(0xFFF44336)),
                            SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Для оценки 1-3 звезды необходимо указать комментарий',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFFF44336),
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ],
                ),
              ),
            ),

            // Кнопки действий
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Color(0xFFF8F9FA),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: _isSubmitting ? null : () => Navigator.pop(context),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'Отмена',
                        style: TextStyle(
                          color: Color(0xFF6C757D),
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _submitRating,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4CAF50),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 3,
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Подтвердить',
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
    );
  }
}