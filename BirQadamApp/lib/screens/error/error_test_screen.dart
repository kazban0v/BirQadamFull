import 'package:flutter/material.dart';
import 'error_screen.dart';

/// Тестовая страница для просмотра всех экранов ошибок
class ErrorTestScreen extends StatelessWidget {
  const ErrorTestScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: const Text(
          'Тест страниц ошибок',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
        centerTitle: true,
        backgroundColor: const Color(0xFF4CAF50),
        elevation: 0,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.all(size.width * 0.04),
        physics: const BouncingScrollPhysics(),
        children: [
          SizedBox(height: size.height * 0.02),
          
          // Заголовок секции
          Padding(
            padding: const EdgeInsets.only(bottom: 16, left: 4),
            child: Text(
              'Доступные экраны ошибок',
              style: TextStyle(
                fontSize: size.width * 0.045,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF2C3E50),
                letterSpacing: 0.2,
              ),
            ),
          ),
          
          _buildTestCard(
            context,
            icon: Icons.error_outline_rounded,
            iconColor: const Color(0xFFE53935),
            title: '404 - Не найдено',
            description: 'Страница не существует',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.notFound(
                  onBack: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
          
          _buildTestCard(
            context,
            icon: Icons.wifi_off_rounded,
            iconColor: const Color(0xFFFF5722),
            title: 'Нет интернета',
            description: 'Отсутствует подключение',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.noInternet(
                  onRetry: () => Navigator.pop(context),
                  onClose: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
          
          _buildTestCard(
            context,
            icon: Icons.location_off_rounded,
            iconColor: const Color(0xFF2196F3),
            title: 'Геолокация не получена',
            description: 'Нет доступа к местоположению',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.noLocation(
                  onClose: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
          
          _buildTestCard(
            context,
            icon: Icons.camera_alt_outlined,
            iconColor: const Color(0xFF9C27B0),
            title: 'Доступ к камере отклонен',
            description: 'Нет разрешения на камеру',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.noCameraAccess(
                  onClose: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
          
          _buildTestCard(
            context,
            icon: Icons.sd_storage_rounded,
            iconColor: const Color(0xFFFF9800),
            title: 'Недостаточно места',
            description: 'Заканчивается память',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.notEnoughStorage(
                  onClose: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
          
          _buildTestCard(
            context,
            icon: Icons.search_off_rounded,
            iconColor: const Color(0xFF00BCD4),
            title: 'Ничего не найдено',
            description: 'Результаты поиска отсутствуют',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.noSearchResults(
                  query: 'тест',
                  onClear: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
          
          _buildTestCard(
            context,
            icon: Icons.cloud_off_rounded,
            iconColor: const Color(0xFFF44336),
            title: 'Ошибка загрузки',
            description: 'Не удалось загрузить данные',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.loadError(
                  onRetry: () => Navigator.pop(context),
                  onClose: () => Navigator.pop(context),
                ),
              ),
            ),
          ),
          
          SizedBox(height: size.height * 0.02),
        ],
      ),
    );
  }

  Widget _buildTestCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String description,
    required VoidCallback onTap,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  // Иконка с градиентом
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          iconColor.withValues(alpha: 0.2),
                          iconColor.withValues(alpha: 0.1),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      icon,
                      color: iconColor,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Текст
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2C3E50),
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          description,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[600],
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // Стрелка
                  Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 18,
                    color: Colors.grey[400],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}