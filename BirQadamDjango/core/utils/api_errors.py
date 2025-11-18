# core/api_errors.py
"""
Централизованная система стандартизированных ошибок API
Обеспечивает единообразный формат ошибок для всех API endpoints
"""

from rest_framework.response import Response
from rest_framework import status


class APIError:
    """
    Стандартизированный формат ошибок API
    
    Все ошибки возвращаются в формате:
    {
        "error": "Human-readable message",
        "error_code": "ERR_XXXX",
        "details": {...}
    }
    """
    
    # ==================== КОДЫ ОШИБОК ====================
    
    # Аутентификация и авторизация (1xxx)
    MISSING_FIELDS = 'ERR_1001'
    PASSWORDS_MISMATCH = 'ERR_1002'
    EMAIL_EXISTS = 'ERR_1003'
    PHONE_EXISTS = 'ERR_1004'
    INVALID_CREDENTIALS = 'ERR_1005'
    TOKEN_EXPIRED = 'ERR_1006'
    ACCOUNT_ALREADY_LINKED = 'ERR_1007'
    PERMISSION_DENIED = 'ERR_1008'
    
    # Проекты (2xxx)
    PROJECT_NOT_FOUND = 'ERR_2001'
    PROJECT_ALREADY_JOINED = 'ERR_2002'
    PROJECT_FULL = 'ERR_2003'
    PROJECT_NOT_APPROVED = 'ERR_2004'
    PROJECT_ARCHIVED = 'ERR_2005'
    
    # Задачи (3xxx)
    TASK_NOT_FOUND = 'ERR_3001'
    TASK_ALREADY_ASSIGNED = 'ERR_3002'
    TASK_DEADLINE_PAST = 'ERR_3003'
    TASK_COMPLETED = 'ERR_3004'
    
    # Фото и медиа (4xxx)
    NO_PHOTOS_SELECTED = 'ERR_4001'
    PHOTO_TOO_LARGE = 'ERR_4002'
    INVALID_FILE_FORMAT = 'ERR_4003'
    PHOTO_UPLOAD_FAILED = 'ERR_4004'
    
    # Валидация данных (6xxx)
    VALIDATION_ERROR = 'ERR_6001'
    INVALID_PHONE_FORMAT = 'ERR_6002'
    INVALID_EMAIL_FORMAT = 'ERR_6003'
    INVALID_DATE_FORMAT = 'ERR_6004'
    
    # Серверные ошибки (9xxx)
    INTERNAL_ERROR = 'ERR_9000'
    DATABASE_ERROR = 'ERR_9001'
    EXTERNAL_SERVICE_ERROR = 'ERR_9002'
    
    # ==================== ОСНОВНОЙ МЕТОД ФОРМАТИРОВАНИЯ ====================
    
    @staticmethod
    def format(error_code: str, message: str, details: dict | None = None, status_code: int = 400):
        """
        Форматирует ошибку в стандартный JSON
        
        Args:
            error_code: Код ошибки (ERR_XXXX)
            message: Человекочитаемое сообщение
            details: Дополнительные детали ошибки (опционально)
            status_code: HTTP статус код (по умолчанию 400)
        
        Returns:
            Response object с форматированной ошибкой
        
        Example:
            return APIError.format(
                'ERR_1003',
                'Email already registered',
                {'email': 'user@example.com'},
                400
            )
        """
        return Response({
            'error': message,
            'error_code': error_code,
            'details': details or {}
        }, status=status_code)
    
    # ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================
    
    # ---- Аутентификация (1xxx) ----
    
    @staticmethod
    def missing_fields(fields: list):
        """Отсутствуют обязательные поля"""
        return APIError.format(
            APIError.MISSING_FIELDS,
            'Missing required fields',
            {'missing_fields': fields},
            status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def passwords_mismatch():
        """Пароли не совпадают"""
        return APIError.format(
            APIError.PASSWORDS_MISMATCH,
            'Passwords do not match',
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def email_exists(email: str | None = None):
        """Email уже зарегистрирован"""
        return APIError.format(
            APIError.EMAIL_EXISTS,
            'This email is already registered',
            {'email': email} if email else {},
            status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def phone_exists(phone: str | None = None):
        """Номер телефона уже зарегистрирован"""
        return APIError.format(
            APIError.PHONE_EXISTS,
            'This phone number is already registered',
            {'phone': phone} if phone else {},
            status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def invalid_credentials():
        """Неверные учётные данные"""
        return APIError.format(
            APIError.INVALID_CREDENTIALS,
            'Invalid email or password',
            status_code=status.HTTP_401_UNAUTHORIZED
        )
    
    @staticmethod
    def token_expired():
        """Токен истёк"""
        return APIError.format(
            APIError.TOKEN_EXPIRED,
            'Your session has expired. Please login again',
            status_code=status.HTTP_401_UNAUTHORIZED
        )
    
    @staticmethod
    def account_already_linked():
        """Аккаунт уже привязан"""
        return APIError.format(
            APIError.ACCOUNT_ALREADY_LINKED,
            'This account is already linked to another platform',
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def permission_denied(action: str | None = None):
        """Недостаточно прав"""
        message = f'You do not have permission to {action}' if action else 'Permission denied'
        return APIError.format(
            APIError.PERMISSION_DENIED,
            message,
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    @staticmethod
    def unauthorized(message: str = "Authentication required"):
        """Требуется авторизация"""
        return APIError.format(
            APIError.INVALID_CREDENTIALS,
            message,
            status_code=status.HTTP_401_UNAUTHORIZED
        )
    
    @staticmethod
    def forbidden(message: str = "Access denied"):
        """Доступ запрещён"""
        return APIError.format(
            APIError.PERMISSION_DENIED,
            message,
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    @staticmethod
    def not_found(message: str = "Resource not found"):
        """Ресурс не найден"""
        return APIError.format(
            'ERR_404',
            message,
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    # ---- Проекты (2xxx) ----
    
    @staticmethod
    def project_not_found(project_id: int | None = None):
        """Проект не найден"""
        return APIError.format(
            APIError.PROJECT_NOT_FOUND,
            'Project not found',
            {'project_id': project_id} if project_id else {},
            status.HTTP_404_NOT_FOUND
        )
    
    @staticmethod
    def project_already_joined():
        """Уже присоединились к проекту"""
        return APIError.format(
            APIError.PROJECT_ALREADY_JOINED,
            'You have already joined this project',
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def project_full():
        """Проект заполнен"""
        return APIError.format(
            APIError.PROJECT_FULL,
            'This project has reached its maximum number of volunteers',
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    # ---- Задачи (3xxx) ----
    
    @staticmethod
    def task_not_found(task_id: int | None = None):
        """Задача не найдена"""
        return APIError.format(
            APIError.TASK_NOT_FOUND,
            'Task not found',
            {'task_id': task_id} if task_id else {},
            status.HTTP_404_NOT_FOUND
        )
    
    @staticmethod
    def task_already_assigned():
        """Задача уже назначена"""
        return APIError.format(
            APIError.TASK_ALREADY_ASSIGNED,
            'This task is already assigned to you',
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    # ---- Фото (4xxx) ----
    
    @staticmethod
    def no_photos_selected():
        """Фото не выбраны"""
        return APIError.format(
            APIError.NO_PHOTOS_SELECTED,
            'Please select at least one photo',
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def photo_too_large(max_size_mb: int = 10):
        """Фото слишком большое"""
        return APIError.format(
            APIError.PHOTO_TOO_LARGE,
            f'Photo size must be less than {max_size_mb}MB',
            {'max_size_mb': max_size_mb},
            status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def invalid_file_format(allowed_formats: list[str] | None = None):
        """Неверный формат файла"""
        if allowed_formats is None:
            allowed_formats = ['jpg', 'jpeg', 'png']
        return APIError.format(
            APIError.INVALID_FILE_FORMAT,
            'Invalid file format',
            {'allowed_formats': allowed_formats},
            status.HTTP_400_BAD_REQUEST
        )
    
    # ---- Валидация (6xxx) ----
    
    @staticmethod
    def validation_error(field: str, message: str):
        """Ошибка валидации поля"""
        return APIError.format(
            APIError.VALIDATION_ERROR,
            f'Validation error: {message}',
            {'field': field, 'message': message},
            status.HTTP_400_BAD_REQUEST
        )
    
    # ---- Серверные ошибки (9xxx) ----
    
    @staticmethod
    def internal_error(exception: Exception | None = None):
        """Внутренняя ошибка сервера"""
        details: dict[str, str] = {}
        if exception:
            details['exception'] = str(exception)
            details['type'] = type(exception).__name__
        
        return APIError.format(
            APIError.INTERNAL_ERROR,
            'An internal server error occurred. Please try again later.',
            details,
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    @staticmethod
    def database_error(exception: Exception | None = None):
        """Ошибка базы данных"""
        details: dict[str, str] = {}
        if exception:
            details['exception'] = str(exception)
        
        return APIError.format(
            APIError.DATABASE_ERROR,
            'A database error occurred. Please try again later.',
            details,
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ==================== ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ ====================

"""
ПРИМЕР 1: Регистрация - отсутствуют поля
-----------------------------------------
if not all([email, password1, password2, phone]):
    return APIError.missing_fields(['email', 'password', 'phone'])

Ответ:
{
    "error": "Missing required fields",
    "error_code": "ERR_1001",
    "details": {"missing_fields": ["email", "password", "phone"]}
}


ПРИМЕР 2: Регистрация - email уже существует
---------------------------------------------
if User.objects.filter(email=email).exists():
    return APIError.email_exists(email)

Ответ:
{
    "error": "This email is already registered",
    "error_code": "ERR_1003",
    "details": {"email": "user@example.com"}
}


ПРИМЕР 3: Вход - неверные учётные данные
-----------------------------------------
if not user or not user.check_password(password):
    return APIError.invalid_credentials()

Ответ:
{
    "error": "Invalid email or password",
    "error_code": "ERR_1005",
    "details": {}
}


ПРИМЕР 4: Внутренняя ошибка
----------------------------
try:
    # ... some code ...
except Exception as e:
    return APIError.internal_error(e)

Ответ:
{
    "error": "An internal server error occurred. Please try again later.",
    "error_code": "ERR_9000",
    "details": {
        "exception": "division by zero",
        "type": "ZeroDivisionError"
    }
}


ПРИМЕР 5: Flutter обработка
----------------------------
// В Flutter можно обрабатывать по error_code:
final response = await http.post(...);
final data = jsonDecode(response.body);

if (data.containsKey('error_code')) {
  switch (data['error_code']) {
    case 'ERR_1003':
      showDialog('Этот email уже зарегистрирован');
      break;
    case 'ERR_1005':
      showDialog('Неверный email или пароль');
      break;
    default:
      showDialog(data['error']);
  }
}
"""





