"""
API endpoints для работы с задачами волонтера
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from api.models import Task, TaskAssignment, Activity
from admin_panel.views.views import CsrfExemptSessionAuthentication
import logging

logger = logging.getLogger(__name__)


class AcceptTaskAPIView(APIView):
    """Волонтёр принимает задачу"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def post(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            # Проверяем, что задача существует и доступна
            task = Task.objects.select_related('project').get(
                id=task_id,
                status='open',
                is_deleted=False
            )

            # Проверяем, что волонтёр является участником проекта
            from api.models import VolunteerProject
            is_participant = VolunteerProject.objects.filter(
                volunteer=request.user,
                project=task.project,
                is_active=True
            ).exists()

            if not is_participant:
                return Response(
                    {'error': 'Вы должны быть участником проекта'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Проверяем, не взята ли уже задача
            existing_assignment = TaskAssignment.objects.filter(
                task=task,
                volunteer=request.user
            ).first()

            if existing_assignment:
                return Response(
                    {'message': 'Вы уже взялись за эту задачу'},
                    status=status.HTTP_200_OK
                )

            # Создаем назначение задачи
            assignment = TaskAssignment.objects.create(
                task=task,
                volunteer=request.user,
                accepted=True
            )

            # Обновляем статус задачи
            task.status = 'in_progress'
            task.save()

            # Создаём активность
            Activity.objects.create(
                user=request.user,
                type='task_assigned',
                title='Взялись за задачу',
                description=f'Вы взялись за выполнение задачи "{task.text}"',
                project=task.project
            )

            logger.info(f"User {request.user.username if hasattr(request.user, 'username') else 'unknown'} accepted task {task_id}")  # type: ignore[attr-defined]

            return Response({
                'message': 'Вы успешно взялись за задачу!',
                'assignment_id': assignment.id if hasattr(assignment, 'id') else None,  # type: ignore[attr-defined]
                'task_status': task.status
            }, status=status.HTTP_201_CREATED)

        except Task.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Задача не найдена или недоступна'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error accepting task: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DeclineTaskAPIView(APIView):
    """Волонтёр отклоняет задачу - создаёт запись об отклонении"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def post(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            # Проверяем, что задача существует
            task = Task.objects.get(id=task_id, is_deleted=False)

            # Проверяем, есть ли назначение
            assignment = TaskAssignment.objects.filter(
                task=task,
                volunteer=request.user
            ).first()

            if assignment:
                # Помечаем как отклоненное (не удаляем)
                assignment.accepted = False
                assignment.save()
                
                # Если нет других принятых назначений, возвращаем задачу в статус 'open'
                if not TaskAssignment.objects.filter(task=task, accepted=True).exists():
                    task.status = 'open'
                    task.save()
            else:
                # Создаем запись об отклонении (без accepted)
                TaskAssignment.objects.create(
                    task=task,
                    volunteer=request.user,
                    accepted=False
                )

            logger.info(f"User {request.user.username if hasattr(request.user, 'username') else 'unknown'} declined task {task_id}")  # type: ignore[attr-defined]

            return Response({
                'message': 'Задача отклонена',
                'task_status': task.status
            }, status=status.HTTP_200_OK)

        except Task.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Задача не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error declining task: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VolunteerTaskDismissAPIView(APIView):
    """Волонтёр убирает завершённую или архивную задачу из своего списка"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def delete(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            task = Task.objects.get(
                id=task_id,
                is_deleted=False,
                status__in=['completed', 'archived'],
            )
        except Task.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Задача не найдена или её нельзя удалить из списка'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Помечаем назначение как «отклонено» — это скрывает задачу из списка.
        # Если назначения нет (задача была открыта и заархивирована без принятия),
        # создаём запись с accepted=False как «маркер скрытия».
        assignment = TaskAssignment.objects.filter(
            task=task,
            volunteer=request.user,
        ).first()

        if assignment:
            assignment.accepted = False
            assignment.save(update_fields=['accepted'])
        else:
            TaskAssignment.objects.create(
                task=task,
                volunteer=request.user,
                accepted=False,
                completed=False,
            )

        logger.info(
            f"User {getattr(request.user, 'username', 'unknown')} dismissed task {task_id}"
        )
        return Response({'message': 'Задача убрана из списка'}, status=status.HTTP_200_OK)


class CompleteTaskAPIView(APIView):
    """Волонтёр завершает задачу"""
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            # Проверяем, что задача существует
            task = Task.objects.select_related('project').get(
                id=task_id,
                is_deleted=False
            )

            # Проверяем, что волонтёр взял задачу
            assignment = TaskAssignment.objects.filter(
                task=task,
                volunteer=request.user,
                accepted=True
            ).first()

            if not assignment:
                return Response(
                    {'error': 'Вы не взяли эту задачу'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Проверяем, не завершена ли уже задача
            if assignment.completed:
                return Response(
                    {'message': 'Задача уже завершена'},
                    status=status.HTTP_200_OK
                )

            # Помечаем задачу как завершенную
            assignment.completed = True
            assignment.completed_at = timezone.now()
            assignment.save()

            # Обновляем статус задачи на 'completed'
            task.status = 'completed'
            task.save()

            # Создаём активность
            Activity.objects.create(
                user=request.user,
                type='task_completed',
                title='Задача выполнена',
                description=f'Вы завершили задачу "{task.text}" в проекте "{task.project.title}"',
                project=task.project
            )

            logger.info(f"User {request.user.username if hasattr(request.user, 'username') else 'unknown'} completed task {task_id}")  # type: ignore[attr-defined]

            return Response({
                'message': 'Задача успешно завершена!',
                'task_status': task.status
            }, status=status.HTTP_200_OK)

        except Task.DoesNotExist:  # type: ignore[attr-defined]
            return Response(
                {'error': 'Задача не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error completing task: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VolunteerTaskDetailAPIView(APIView):
    """Детальная информация о задаче для волонтера"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            # Ищем задачу. Она не должна быть удалена.
            # Мы разрешаем просмотр даже если она в архиве (status='archived')
            task = Task.objects.select_related('project', 'project__creator').get(
                id=task_id,
                is_deleted=False
            )
            
            # Проверяем назначение
            assignment = TaskAssignment.objects.filter(
                task=task,
                volunteer=request.user,
                accepted=True
            ).first()
            
            # Проверяем, является ли волонтер участником проекта
            from api.models import VolunteerProject
            is_participant = VolunteerProject.objects.filter(
                volunteer=request.user,
                project=task.project,
                is_active=True
            ).exists()
            
            # Если задача в архиве, она должна быть доступна тем, кто был участником проекта
            if task.status == 'archived':
                was_participant = VolunteerProject.objects.filter(
                    volunteer=request.user,
                    project=task.project
                ).exists()
                if not was_participant:
                    return Response(
                        {'detail': 'Задача не найдена или не назначена вам.'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            elif not assignment and not is_participant and task.status != 'open':
                # Если не назначен, не активный участник и задача не открыта - 404
                return Response(
                    {'detail': 'Задача не найдена или не назначена вам.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Собираем данные
            accepted = bool(assignment and assignment.accepted)
            completed = bool(assignment and assignment.completed)
            
            # Проверяем фотоотчет
            from api.models import Photo
            photo = Photo.objects.filter(
                task=task,
                volunteer=request.user,
                is_deleted=False
            ).order_by('-uploaded_at').first()
            
            has_photo_report = photo is not None
            photo_status = photo.status if photo else None
            photo_uploaded_at = photo.uploaded_at.isoformat() if photo and photo.uploaded_at else None
            photo_moderated_at = photo.moderated_at.isoformat() if photo and photo.moderated_at else None

            # Загрузить фото можно если принята и еще не завершена (или на проверке)
            can_upload_photo = accepted and not has_photo_report and task.status in ['in_progress', 'under_review']
            
            # Хелпер для абсолютных URL
            def get_absolute_url(path):
                if not path: return None
                url = request.build_absolute_uri(path)
                # Don't force HTTPS for localhost or local network IPs
                is_local = any(x in url for x in ['localhost', '127.0.0.1', '192.168.', '10.', '172.'])
                if url.startswith('http://') and not is_local:
                    url = url.replace('http://', 'https://')
                return url
            
            creator_avatar = None
            if hasattr(task.project.creator, 'avatar') and getattr(task.project.creator.avatar, 'name', None):
                creator_avatar = get_absolute_url(task.project.creator.avatar.url)

            accepted_at = None
            if accepted:
                from api.models import Activity
                accepted_activity = Activity.objects.filter(
                    user=request.user,
                    type='task_assigned',
                    project=task.project,
                    description__icontains=task.text[:30]
                ).order_by('-created_at').first()
                if accepted_activity:
                    accepted_at = accepted_activity.created_at.isoformat()

            # Using task_image if available, otherwise fallback to project image
            image = None
            if hasattr(task, 'task_image') and getattr(task.task_image, 'name', None):
                image = get_absolute_url(task.task_image.url)
            elif hasattr(task.project, 'cover_image') and getattr(task.project.cover_image, 'name', None):
                image = get_absolute_url(task.project.cover_image.url)

            data = {
                'id': task.id,
                'task_id': task.id,
                'title': task.text, # Маппинг для фронтенда
                'text': task.text,
                'description': task.text, # Маппинг для фронтенда (если нет отдельного поля)
                'status': task.status,
                'image': image,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'deadline_date': task.deadline_date.isoformat() if task.deadline_date else None,
                'end_date': task.deadline_date.isoformat() if task.deadline_date else None, # Маппинг для фронтенда
                'start_time': task.start_time.strftime('%H:%M') if task.start_time else None,
                'end_time': task.end_time.strftime('%H:%M') if task.end_time else None,
                'project_id': task.project_id,
                'project_title': task.project.title,
                'project_city': task.project.city,
                'project_status': task.project.status,
                'creator_name': task.project.creator.name or task.project.creator.username,
                'creator_avatar': creator_avatar,
                'accepted': accepted,
                'accepted_at': accepted_at,
                'completed': completed,
                'completed_at': assignment.completed_at.isoformat() if assignment and assignment.completed_at else None,
                'is_assigned': accepted,
                'is_expired': task.is_expired(),
                'has_photo_report': has_photo_report,
                'photo_status': photo_status,
                'photo_uploaded_at': photo_uploaded_at,
                'photo_moderated_at': photo_moderated_at,
                'can_upload_photo': can_upload_photo,
                'location': task.project.city or 'Город',
                'reward_points': task.reward_points if hasattr(task, 'reward_points') else 10,
                'rating': assignment.rating if assignment else None,
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Task.DoesNotExist:
            return Response(
                {'detail': 'Задача не найдена.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in VolunteerTaskDetailAPIView: {e}", exc_info=True)
            return Response(
                {'detail': 'Произошла ошибка при получении данных задачи.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )