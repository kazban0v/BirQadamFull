"""
API endpoints for chat functionality
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.http import HttpRequest
from django.utils import timezone
from typing import Any
import logging

from core.models import Chat, Message, Project, VolunteerProject

logger = logging.getLogger(__name__)


class ProjectChatAPIView(APIView):
    """Получить или создать чат для проекта"""
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest, project_id: int) -> Response:
        """Получить чат проекта"""
        try:
            # Проверяем, что проект существует
            project = Project.objects.get(id=project_id, deleted_at__isnull=True)
            
            # Проверяем доступ: пользователь должен быть либо организатором проекта, либо волонтером
            is_organizer = project.creator == request.user
            is_volunteer = VolunteerProject.objects.filter(
                project=project,
                volunteer=request.user,
                is_active=True
            ).exists()
            
            if not (is_organizer or is_volunteer):
                return Response(
                    {'error': 'У вас нет доступа к чату этого проекта'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Получаем или создаем чат для проекта
            chat, created = Chat.objects.get_or_create(
                project=project,
                chat_type='project',
                defaults={
                    'name': f'Чат проекта: {project.title}',
                    'is_active': True,
                }
            )
            
            # Добавляем организатора в участники, если его там нет
            if project.creator not in chat.participants.all():
                chat.participants.add(project.creator)
            
            # Добавляем текущего пользователя в участники, если его там нет
            if request.user not in chat.participants.all():
                chat.participants.add(request.user)
            
            # Добавляем всех активных волонтеров проекта в участники
            active_volunteers = VolunteerProject.objects.filter(
                project=project,
                is_active=True
            ).select_related('volunteer').values_list('volunteer', flat=True)
            
            for volunteer_id in active_volunteers:
                from core.models import User
                try:
                    volunteer = User.objects.get(id=volunteer_id)
                    if volunteer not in chat.participants.all():
                        chat.participants.add(volunteer)
                except User.DoesNotExist:
                    pass
            
            # Получаем всех участников чата
            participants = []
            for participant in chat.participants.all():
                participants.append({
                    'id': participant.id,
                    'name': participant.name or participant.username,
                    'email': participant.email or '',
                    'is_organizer': participant == project.creator,
                })
            
            # Получаем количество непрочитанных сообщений
            unread_count = chat.messages.filter(
                is_read=False,
                is_deleted=False
            ).exclude(sender=request.user).count()
            
            return Response({
                'id': chat.id,
                'project_id': project.id,
                'project_title': project.title,
                'chat_type': chat.chat_type,
                'participants': participants,
                'unread_count': unread_count,
                'created': created,
            }, status=status.HTTP_200_OK)
            
        except Project.DoesNotExist:
            return Response(
                {'error': 'Проект не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error getting project chat: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChatMessagesAPIView(APIView):
    """Получить сообщения чата"""
    permission_classes = [IsAuthenticated]

    def get(self, request: HttpRequest, chat_id: int) -> Response:
        """Получить сообщения чата"""
        try:
            chat = Chat.objects.select_related('project').get(
                id=chat_id,
                is_active=True
            )
            
            # Проверяем доступ
            if request.user not in chat.participants.all():
                return Response(
                    {'error': 'У вас нет доступа к этому чату'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Получаем сообщения
            limit = int(request.query_params.get('limit', 50))
            offset = int(request.query_params.get('offset', 0))
            
            messages_qs = chat.messages.filter(
                is_deleted=False
            ).select_related('sender').order_by('-created_at')[offset:offset + limit]
            
            messages = []
            for msg in reversed(messages_qs):  # Переворачиваем для правильного порядка
                messages.append({
                    'id': msg.id,
                    'text': msg.text,
                    'sender_id': msg.sender.id,
                    'sender_name': msg.sender.name or msg.sender.username,
                    'sender_is_organizer': msg.sender == chat.project.creator if chat.project else False,
                    'message_type': msg.message_type,
                    'image_url': msg.image.url if msg.image else None,
                    'file_url': msg.file.url if msg.file else None,
                    'is_read': msg.is_read,
                    'created_at': msg.created_at.isoformat(),
                })
            
            return Response({
                'messages': messages,
                'count': len(messages),
            }, status=status.HTTP_200_OK)
            
        except Chat.DoesNotExist:
            return Response(
                {'error': 'Чат не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error getting chat messages: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendMessageAPIView(APIView):
    """Отправить сообщение в чат"""
    permission_classes = [IsAuthenticated]

    def post(self, request: HttpRequest, chat_id: int) -> Response:
        """Отправить сообщение"""
        try:
            chat = Chat.objects.select_related('project').get(
                id=chat_id,
                is_active=True
            )
            
            # Проверяем доступ
            if request.user not in chat.participants.all():
                return Response(
                    {'error': 'У вас нет доступа к этому чату'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            text = request.data.get('text', '').strip()
            if not text:
                return Response(
                    {'error': 'Текст сообщения не может быть пустым'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Создаем сообщение
            message = Message.objects.create(
                chat=chat,
                sender=request.user,
                text=text,
                message_type='text',
                is_delivered=True,
                delivered_at=timezone.now(),
            )
            
            # Обновляем время обновления чата
            chat.updated_at = timezone.now()
            chat.save(update_fields=['updated_at'])
            
            return Response({
                'id': message.id,
                'text': message.text,
                'sender_id': message.sender.id,
                'sender_name': message.sender.name or message.sender.username,
                'sender_is_organizer': message.sender == chat.project.creator if chat.project else False,
                'message_type': message.message_type,
                'created_at': message.created_at.isoformat(),
            }, status=status.HTTP_201_CREATED)
            
        except Chat.DoesNotExist:
            return Response(
                {'error': 'Чат не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error sending message: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MarkMessagesReadAPIView(APIView):
    """Отметить сообщения как прочитанные"""
    permission_classes = [IsAuthenticated]

    def post(self, request: HttpRequest, chat_id: int) -> Response:
        """Отметить все сообщения в чате как прочитанные"""
        try:
            chat = Chat.objects.get(
                id=chat_id,
                is_active=True
            )
            
            # Проверяем доступ
            if request.user not in chat.participants.all():
                return Response(
                    {'error': 'У вас нет доступа к этому чату'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Отмечаем все непрочитанные сообщения (кроме своих) как прочитанные
            updated = chat.messages.filter(
                is_read=False,
                is_deleted=False
            ).exclude(sender=request.user).update(
                is_read=True,
                read_at=timezone.now()
            )
            
            return Response({
                'message': 'Сообщения отмечены как прочитанные',
                'updated_count': updated,
            }, status=status.HTTP_200_OK)
            
        except Chat.DoesNotExist:
            return Response(
                {'error': 'Чат не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error marking messages as read: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
