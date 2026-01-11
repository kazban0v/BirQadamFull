import requests
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import EmailMessage
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class SendGridEmailBackend(BaseEmailBackend):
    """
    Email backend для SendGrid API (https://sendgrid.com)
    Работает через HTTP REST API, поэтому не требует SMTP подключений
    """
    
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, 'SENDGRID_API_KEY', None)
        self.api_url = 'https://api.sendgrid.com/v3/mail/send'
        
        if not self.api_key and not self.fail_silently:
            logger.warning('SENDGRID_API_KEY не установлен. SendGrid не будет работать.')
    
    def send_messages(self, email_messages):
        """
        Отправляет список email сообщений через SendGrid API
        """
        if not email_messages:
            return 0
        
        if not self.api_key:
            if self.fail_silently:
                return 0
            raise ValueError('SENDGRID_API_KEY не установлен в settings или переменных окружения')
        
        num_sent = 0
        for message in email_messages:
            if self._send_email(message):
                num_sent += 1
        
        return num_sent
    
    def _send_email(self, message: EmailMessage):
        """
        Отправляет одно email сообщение через SendGrid API
        """
        try:
            # Подготовка данных для SendGrid API v3
            # SendGrid требует специальный формат JSON
            personalizations = [{
                'to': [{'email': email} for email in message.to],
            }]
            
            # Добавляем CC если есть
            if message.cc:
                personalizations[0]['cc'] = [{'email': email} for email in message.cc]
            
            # Добавляем BCC если есть
            if message.bcc:
                personalizations[0]['bcc'] = [{'email': email} for email in message.bcc]
            
            payload = {
                'personalizations': personalizations,
                'from': {
                    'email': message.from_email or settings.DEFAULT_FROM_EMAIL
                },
                'subject': message.subject,
                'content': [
                    {
                        'type': 'text/plain',
                        'value': message.body
                    }
                ]
            }
            
            # Если есть HTML версия, добавляем её
            if hasattr(message, 'alternatives') and message.alternatives:
                for content, mimetype in message.alternatives:
                    if mimetype == 'text/html':
                        payload['content'].insert(0, {
                            'type': 'text/html',
                            'value': content
                        })
            
            # Добавляем reply_to если есть
            if message.reply_to:
                payload['reply_to'] = {
                    'email': message.reply_to[0] if isinstance(message.reply_to, list) else message.reply_to
                }
            
            # Отправка запроса к SendGrid API
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json',
            }
            
            print(f"[SENDGRID] Sending email to {message.to} via SendGrid API")
            print(f"[SENDGRID] From: {message.from_email or settings.DEFAULT_FROM_EMAIL}")
            print(f"[SENDGRID] Subject: {message.subject}")
            logger.info(f"Sending email to {message.to} via SendGrid API")
            logger.debug(f"SendGrid payload: {payload}")
            
            response = requests.post(
                self.api_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            # Логируем полный ответ от SendGrid
            print(f"[SENDGRID] Response status: {response.status_code}")
            logger.info(f"SendGrid API response status: {response.status_code}")
            
            if response.status_code in (200, 202):
                response_data = response.text
                print(f"[SENDGRID] ✓ Email accepted by SendGrid API (status {response.status_code})")
                if response_data:
                    print(f"[SENDGRID] Response body: {response_data}")
                    logger.info(f"SendGrid API response: {response_data}")
                logger.info(f"Email successfully sent via SendGrid to {message.to}")
                return True
            else:
                error_msg = f"SendGrid API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                print(f"[SENDGRID] ✗ {error_msg}")
                
                # Детальный анализ ошибки
                try:
                    error_json = response.json()
                    if 'errors' in error_json:
                        for err in error_json['errors']:
                            error_detail = f"SendGrid error: {err.get('message', 'Unknown error')} (field: {err.get('field', 'N/A')})"
                            print(f"[SENDGRID] {error_detail}")
                            logger.error(error_detail)
                except:
                    pass
                
                if not self.fail_silently:
                    raise Exception(error_msg)
                return False
                
        except Exception as e:
            error_msg = f"Error sending email via SendGrid: {str(e)}"
            logger.error(error_msg, exc_info=True)
            print(f"[SENDGRID] ✗ {error_msg}")
            if not self.fail_silently:
                raise
            return False

