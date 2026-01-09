from django.urls import path
from . import views
from django.conf.urls.static import static
from django.conf import settings
from django.contrib.auth import views as auth_views
from .views.views import ProfileView, ProfileUpdateView, RapidPasswordResetView
from .views.views import project_detail, ProjectUpdateView, ProjectDeleteView
from .views.views import RegisterAPIView, LoginAPIView, ProfileAPIView, ProjectsAPIView, JoinProjectAPIView, UserTasksAPIView, OrganizerProjectsAPIView, ProjectParticipantsAPIView, ProjectManagementAPIView, ProjectTasksAPIView, LeaveProjectAPIView, DeviceTokenAPIView, ActivitiesAPIView, AchievementsAPIView, UserProgressAPIView, LeaderboardAPIView
from .api.photo import SubmitPhotoReportAPIView, OrganizerPhotoReportsAPIView, PhotoReportDetailAPIView, RatePhotoReportAPIView, RejectPhotoReportAPIView, VolunteerPhotoReportsAPIView, TaskPhotosAPIView
from .api.task import AcceptTaskAPIView, DeclineTaskAPIView, CompleteTaskAPIView
from .api.bulk_notifications import create_bulk_notification, send_bulk_notification, list_bulk_notifications, get_bulk_notification, list_notification_templates, preview_recipients
from .api.search import global_search, advanced_user_search, advanced_project_search, save_search_filter, list_saved_filters
from .api.map import get_projects_map_data, get_heatmap_data, get_city_statistics, get_project_clusters, get_volunteer_heatmap
from .views.map import MapProjectsView, MapStatsView
from .views.views import bulk_notifications as bulk_notifications_view, global_search as global_search_view, activity_map as activity_map_view
from .api.calendar import CalendarAPIView, EventDetailAPIView, EventParticipantsAPIView
from .api.geofence import GeofenceReminderAPIView, GeofenceReminderDetailAPIView, GeofenceCheckAPIView, GeofenceProjectsAPIView, GeofenceEventsAPIView
from .api.stats import UserStatsAPIView, UserActivityStatsAPIView
from .api.chat import (
    ProjectChatAPIView, ChatMessagesAPIView, SendMessageAPIView, MarkMessagesReadAPIView
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # JWT токены
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('', views.dashboard, name='dashboard'),
    path('volunteers/', views.volunteers, name='volunteers'),
    path('volunteers/<int:user_id>/', views.volunteers, name='volunteer_analytics'),
    path('organizers/', views.organizers, name='organizers'),
    path('organizers/<int:user_id>/', views.organizers, name='organizer_analytics'),
    path('organizers/<int:user_id>/approve/', views.approve_organizer, name='approve_organizer'),
    path('organizers/<int:user_id>/reject/', views.reject_organizer, name='reject_organizer'),
    path('projects/', views.project_list, name='project_list'),
    path('tasks/', views.TaskListView.as_view(), name='task_list'),
    path('analytics/', views.analytics, name='analytics'),
    path('export/', views.export_report, name='export_report'),
    path('bulk-notifications/', bulk_notifications_view, name='bulk_notifications'),
    path('search/', global_search_view, name='global_search'),
    path('map/', activity_map_view, name='activity_map'),
    path('calendar/', views.calendar_admin, name='calendar_admin'),  # 📅 NEW: Календарь для администратора
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.custom_logout, name='logout'),

    # Password reset flow
    path('password_reset/', auth_views.PasswordResetView.as_view(
        template_name='custom_admin/password_reset.html',
        email_template_name='custom_admin/password_reset_email.html',
        subject_template_name='custom_admin/password_reset_subject.txt',
        success_url='done/',
        extra_context={'hide_sidebar': True}
    ), name='password_reset'),
    path('password_reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='custom_admin/password_reset_done.html',
        extra_context={'hide_sidebar': True}
    ), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='custom_admin/password_reset_confirm.html',
        success_url='/custom-admin/reset/done/',
        extra_context={'hide_sidebar': True}
    ), name='password_reset_confirm'),
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(
        template_name='custom_admin/password_reset_complete.html',
        extra_context={'hide_sidebar': True}
    ), name='password_reset_complete'),

    # Projects
    path('projects/<int:pk>/', project_detail, name='project_detail'),
    path('projects/<int:pk>/edit/', ProjectUpdateView.as_view(), name='project_edit'),
    path('projects/<int:pk>/delete/', ProjectDeleteView.as_view(), name='project_delete'),
    path('projects/<int:pk>/feedback/', views.project_feedback, name='project_feedback'),
    path('projects/<int:pk>/restore/', views.project_restore, name='project_restore'),
    path('feedback/<int:session_id>/', views.feedback_detail, name='feedback_detail'),

    # Profile
    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile/edit/', ProfileUpdateView.as_view(), name='profile_edit'),

    # ✅ ИСПРАВЛЕНИЕ СП-2: API v1 (версионированные endpoints)
    # API v1 endpoints
    path('api/v1/register/', RegisterAPIView.as_view(), name='api_v1_register'),
    path('api/v1/login/', LoginAPIView.as_view(), name='api_v1_login'),
    path('api/v1/profile/', ProfileAPIView.as_view(), name='api_v1_profile'),
    path('api/v1/projects/', ProjectsAPIView.as_view(), name='api_v1_projects'),
    path('api/v1/projects/<int:project_id>/join/', JoinProjectAPIView.as_view(), name='api_v1_join_project'),
    path('api/v1/tasks/', UserTasksAPIView.as_view(), name='api_v1_user_tasks'),
    path('api/v1/organizer/projects/', OrganizerProjectsAPIView.as_view(), name='api_v1_organizer_projects'),
    path('api/v1/projects/<int:project_id>/participants/', ProjectParticipantsAPIView.as_view(), name='api_v1_project_participants'),
    path('api/v1/projects/<int:project_id>/manage/', ProjectManagementAPIView.as_view(), name='api_v1_project_management'),
    path('api/v1/projects/<int:project_id>/tasks/', ProjectTasksAPIView.as_view(), name='api_v1_project_tasks'),
    path('api/v1/projects/<int:project_id>/leave/', LeaveProjectAPIView.as_view(), name='api_v1_leave_project'),
    path('api/v1/device-token/', DeviceTokenAPIView.as_view(), name='api_v1_device_token'),
    path('api/v1/activities/', ActivitiesAPIView.as_view(), name='api_v1_activities'),
    path('api/v1/achievements/', AchievementsAPIView.as_view(), name='api_v1_achievements'),
    path('api/v1/achievements/progress/', UserProgressAPIView.as_view(), name='api_v1_user_progress'),
    path('api/v1/leaderboard/', LeaderboardAPIView.as_view(), name='api_v1_leaderboard'),
    
    # Photo reports API v1
    path('api/v1/tasks/<int:task_id>/photo-reports/', SubmitPhotoReportAPIView.as_view(), name='api_v1_submit_photo_report'),
    path('api/v1/organizer/photo-reports/', OrganizerPhotoReportsAPIView.as_view(), name='api_v1_organizer_photo_reports'),
    path('api/v1/photo-reports/', VolunteerPhotoReportsAPIView.as_view(), name='api_v1_volunteer_photo_reports'),
    path('api/v1/photo-reports/<int:photo_id>/', PhotoReportDetailAPIView.as_view(), name='api_v1_photo_report_detail'),
    path('api/v1/photo-reports/<int:photo_id>/rate/', RatePhotoReportAPIView.as_view(), name='api_v1_rate_photo_report'),
    path('api/v1/photo-reports/<int:photo_id>/reject/', RejectPhotoReportAPIView.as_view(), name='api_v1_reject_photo_report'),
    
    # Task action API v1
    path('api/v1/tasks/<int:task_id>/accept/', AcceptTaskAPIView.as_view(), name='api_v1_accept_task'),
    path('api/v1/tasks/<int:task_id>/decline/', DeclineTaskAPIView.as_view(), name='api_v1_decline_task'),
    path('api/v1/tasks/<int:task_id>/complete/', CompleteTaskAPIView.as_view(), name='api_v1_complete_task'),
    path('api/v1/tasks/<int:task_id>/photos/', TaskPhotosAPIView.as_view(), name='api_v1_task_photos'),
    
    # 📨 Bulk Notifications API v1
    path('api/v1/bulk-notifications/create/', create_bulk_notification, name='api_v1_create_bulk_notification'),
    path('api/v1/bulk-notifications/<int:notification_id>/send/', send_bulk_notification, name='api_v1_send_bulk_notification'),
    path('api/v1/bulk-notifications/', list_bulk_notifications, name='api_v1_list_bulk_notifications'),
    path('api/v1/bulk-notifications/<int:notification_id>/', get_bulk_notification, name='api_v1_get_bulk_notification'),
    path('api/v1/notification-templates/', list_notification_templates, name='api_v1_notification_templates'),
    path('api/v1/bulk-notifications/preview-recipients/', preview_recipients, name='api_v1_preview_recipients'),
    
    # 🔍 Search API v1
    path('api/v1/search/global/', global_search, name='api_v1_global_search'),
    path('api/v1/search/users/', advanced_user_search, name='api_v1_advanced_user_search'),
    path('api/v1/search/projects/', advanced_project_search, name='api_v1_advanced_project_search'),
    path('api/v1/search/save-filter/', save_search_filter, name='api_v1_save_search_filter'),
    path('api/v1/search/saved-filters/', list_saved_filters, name='api_v1_list_saved_filters'),
    
    # 🗺️ Map API v1
    path('api/v1/map/projects/', MapProjectsView.as_view(), name='api_v1_map_projects'),  # NEW: Мобильное приложение
    path('api/v1/map/stats/', MapStatsView.as_view(), name='api_v1_map_stats'),  # NEW: Статистика карты
    path('api/v1/map/projects-web/', get_projects_map_data, name='api_v1_projects_map_web'),  # Веб админ-панель
    path('api/v1/map/heatmap/', get_heatmap_data, name='api_v1_heatmap'),
    path('api/v1/map/city-stats/', get_city_statistics, name='api_v1_city_stats'),
    path('api/v1/map/clusters/', get_project_clusters, name='api_v1_project_clusters'),
    path('api/v1/map/volunteer-heatmap/', get_volunteer_heatmap, name='api_v1_volunteer_heatmap'),
    
    # 📅 Calendar API v1
    path('api/v1/calendar/events/', CalendarAPIView.as_view(), name='api_v1_calendar_events'),
    path('api/v1/calendar/events/<int:event_id>/', EventDetailAPIView.as_view(), name='api_v1_event_detail'),
    path('api/v1/calendar/events/<int:event_id>/participants/', EventParticipantsAPIView.as_view(), name='api_v1_event_participants'),
    
    # 📍 Geofence Reminders API v1
    path('api/v1/geofence/reminders/', GeofenceReminderAPIView.as_view(), name='api_v1_geofence_reminders'),
    path('api/v1/geofence/reminders/<int:reminder_id>/', GeofenceReminderDetailAPIView.as_view(), name='api_v1_geofence_reminder_detail'),
    path('api/v1/geofence/check/', GeofenceCheckAPIView.as_view(), name='api_v1_geofence_check'),
    path('api/v1/geofence/projects/', GeofenceProjectsAPIView.as_view(), name='api_v1_geofence_projects'),
    path('api/v1/geofence/events/', GeofenceEventsAPIView.as_view(), name='api_v1_geofence_events'),
    
    # 📊 User Statistics API v1
    path('api/v1/user/stats/', UserStatsAPIView.as_view(), name='api_v1_user_stats'),
    path('api/v1/user/activity-stats/', UserActivityStatsAPIView.as_view(), name='api_v1_user_activity_stats'),
    
    # 💬 Chat API v1
    path('api/v1/projects/<int:project_id>/chat/', ProjectChatAPIView.as_view(), name='api_v1_project_chat'),
    path('api/v1/chats/<int:chat_id>/messages/', ChatMessagesAPIView.as_view(), name='api_v1_chat_messages'),
    path('api/v1/chats/<int:chat_id>/send/', SendMessageAPIView.as_view(), name='api_v1_send_message'),
    path('api/v1/chats/<int:chat_id>/read/', MarkMessagesReadAPIView.as_view(), name='api_v1_mark_messages_read'),
    
    # ✅ Старые endpoints (без версии) - для обратной совместимости
    # Перенаправляют на v1
    path('api/register/', RegisterAPIView.as_view(), name='api_register'),
    path('api/login/', LoginAPIView.as_view(), name='api_login'),
    path('api/profile/', ProfileAPIView.as_view(), name='api_profile'),
    path('api/projects/', ProjectsAPIView.as_view(), name='api_projects'),
    path('api/projects/<int:project_id>/join/', JoinProjectAPIView.as_view(), name='api_join_project'),
    path('api/tasks/', UserTasksAPIView.as_view(), name='api_user_tasks'),
    path('api/organizer/projects/', OrganizerProjectsAPIView.as_view(), name='api_organizer_projects'),
    path('api/projects/<int:project_id>/participants/', ProjectParticipantsAPIView.as_view(), name='api_project_participants'),
    path('api/projects/<int:project_id>/manage/', ProjectManagementAPIView.as_view(), name='api_project_management'),
    path('api/projects/<int:project_id>/tasks/', ProjectTasksAPIView.as_view(), name='api_project_tasks'),
    path('api/projects/<int:project_id>/leave/', LeaveProjectAPIView.as_view(), name='api_leave_project'),
    path('api/device-token/', DeviceTokenAPIView.as_view(), name='api_device_token'),
    path('api/activities/', ActivitiesAPIView.as_view(), name='api_activities'),
    path('api/achievements/', AchievementsAPIView.as_view(), name='api_achievements'),
    path('api/achievements/progress/', UserProgressAPIView.as_view(), name='api_user_progress'),
    path('api/leaderboard/', LeaderboardAPIView.as_view(), name='api_leaderboard'),
    path('api/tasks/<int:task_id>/photo-reports/', SubmitPhotoReportAPIView.as_view(), name='api_submit_photo_report'),
    path('api/organizer/photo-reports/', OrganizerPhotoReportsAPIView.as_view(), name='api_organizer_photo_reports'),
    path('api/photo-reports/', VolunteerPhotoReportsAPIView.as_view(), name='api_volunteer_photo_reports'),
    path('api/photo-reports/<int:photo_id>/', PhotoReportDetailAPIView.as_view(), name='api_photo_report_detail'),
    path('api/photo-reports/<int:photo_id>/rate/', RatePhotoReportAPIView.as_view(), name='api_rate_photo_report'),
    path('api/photo-reports/<int:photo_id>/reject/', RejectPhotoReportAPIView.as_view(), name='api_reject_photo_report'),
    path('api/tasks/<int:task_id>/accept/', AcceptTaskAPIView.as_view(), name='api_accept_task'),
    path('api/tasks/<int:task_id>/decline/', DeclineTaskAPIView.as_view(), name='api_decline_task'),
    path('api/tasks/<int:task_id>/photos/', TaskPhotosAPIView.as_view(), name='api_task_photos'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)