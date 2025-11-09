import '../../config/app_config.dart';
import '../../providers/settings_provider.dart'; // ✅ NEW

class ApiService {
  // ✅ UPDATED: Функция для определения базового URL с учетом сети
  static String getBaseUrl({SettingsProvider? settingsProvider}) {
    // Если передан SettingsProvider, используем эффективный URL с учетом сети
    if (settingsProvider != null) {
      final effectiveUrl = settingsProvider.getEffectiveApiUrl();
      if (effectiveUrl != null && effectiveUrl.isNotEmpty) {
        return effectiveUrl;
      }
    }
    
    // Fallback: используем конфигурацию из app_config.dart
    return AppConfig.apiBaseUrl;
  }

  // API endpoints
  static String get apiBase => '${getBaseUrl()}/custom-admin/api';

  // Auth endpoints
  static String get loginUrl => '$apiBase/login/';
  static String get registerUrl => '$apiBase/register/';
  static String get profileUrl => '$apiBase/profile/';
  static String get tokenRefreshUrl => '$apiBase/token/refresh/';

  // Project endpoints
  static String get projectsUrl => '$apiBase/projects/';
  static String get organizerProjectsUrl => '$apiBase/organizer/projects/';

  static String projectJoinUrl(int projectId) => '$apiBase/projects/$projectId/join/';
  static String projectLeaveUrl(int projectId) => '$apiBase/projects/$projectId/leave/';
  static String projectManageUrl(int projectId) => '$apiBase/projects/$projectId/manage/';
  static String projectParticipantsUrl(int projectId) => '$apiBase/projects/$projectId/participants/';
  static String projectTasksUrl(int projectId) => '$apiBase/projects/$projectId/tasks/';

  // Task endpoints
  static String get tasksUrl => '$apiBase/tasks/';

  static String acceptTaskUrl(int taskId) => '$apiBase/tasks/$taskId/accept/';
  static String declineTaskUrl(int taskId) => '$apiBase/tasks/$taskId/decline/';

  // Device token endpoint
  static String get deviceTokenUrl => '$apiBase/device-token/';

  // Achievements endpoints
  static String get achievementsUrl => '$apiBase/achievements/';
  static String get userProgressUrl => '$apiBase/achievements/progress/';

  // Activity endpoints
  static String get activitiesUrl => '$apiBase/activities/';

  // Leaderboard endpoints
  static String get leaderboardUrl => '$apiBase/leaderboard/';

  // Photo reports endpoints
  static String submitPhotoReportUrl(int taskId) => '$apiBase/tasks/$taskId/photo-reports/';
  static String get organizerPhotoReportsUrl => '$apiBase/organizer/photo-reports/';
  static String get volunteerPhotoReportsUrl => '$apiBase/photo-reports/';
  static String photoReportDetailUrl(int photoId) => '$apiBase/photo-reports/$photoId/';
  static String ratePhotoReportUrl(int photoId) => '$apiBase/photo-reports/$photoId/rate/';
  static String rejectPhotoReportUrl(int photoId) => '$apiBase/photo-reports/$photoId/reject/';
}
