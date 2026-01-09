package com.example.cleanupv1

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.app.NotificationManager
import android.app.NotificationChannel
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.example.cleanupv1/notifications"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // Создаем канал уведомлений для Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "cleanup_channel",
                "BirQadam Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Уведомления от BirQadam"
                enableVibration(true)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "showExpandableNotification") {
                val title = call.argument<String>("title") ?: "BirQadam"
                val body = call.argument<String>("body") ?: ""
                showExpandableNotification(title, body)
                result.success(true)
            } else {
                result.notImplemented()
            }
        }
    }

    private fun showExpandableNotification(title: String, body: String) {
        val notification = NotificationCompat.Builder(this, "cleanup_channel")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText(body)
                .setBigContentTitle(title))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), notification)
    }
}
