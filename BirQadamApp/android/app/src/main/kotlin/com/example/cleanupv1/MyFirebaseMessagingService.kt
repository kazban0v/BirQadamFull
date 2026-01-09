package com.example.cleanupv1

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        // Получаем данные уведомления
        val title = remoteMessage.notification?.title ?: "BirQadam"
        val body = remoteMessage.notification?.body ?: ""
        
        // Показываем расширяемое уведомление
        showExpandableNotification(title, body)
    }
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Отправляем новый токен на сервер
        sendTokenToServer(token)
    }
    
    private fun showExpandableNotification(title: String, body: String) {
        val channelId = "cleanup_channel"
        val notificationId = System.currentTimeMillis().toInt()
        
        // Создаем intent для открытия приложения при клике
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent, 
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        // Создаем канал уведомлений для Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "BirQadam Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Уведомления от BirQadam"
                enableVibration(true)
                enableLights(true)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
        
        // Создаем расширяемое уведомление с BigTextStyle
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Замените на свою иконку
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText(body) // Полный текст при развертывании
                .setBigContentTitle(title)
                .setSummaryText("BirQadam")) // Подпись внизу
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true) // Автоматически закрывается при клике
            .build()
        
        // Показываем уведомление
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(notificationId, notification)
    }
    
    private fun sendTokenToServer(token: String) {
        // TODO: Отправить токен на ваш backend
        // Пример: API вызов для регистрации токена
        android.util.Log.d("FCM_TOKEN", "New token: $token")
    }
}

