"""
API endpoints для работы с задачами волонтера
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from core.models import Task, TaskAssignment, Activity
import logging

logger = logging.getLogger(__name__)


class AcceptTaskAPIView(APIView):
    """Волонтёр принимает задачу"""
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, task_id: int) -> Response:  # type: ignore[override]
        try:
            # Проверяем, что задача существует и доступна
            task = Task.objects.select_related('project').get(
                id=task_id,
                status='open',
                is_deleted=False
            )

            # Проверяем, что волонтёр является участником проекта
            from core.models import VolunteerProject
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