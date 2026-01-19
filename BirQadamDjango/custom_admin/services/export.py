"""
✅ УЛУЧШЕННЫЙ экспорт отчетов - Красивые CSV и PDF
"""
import csv
from typing import Any, Dict
from io import BytesIO
from datetime import datetime
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.platypus import Image as RLImage
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

try:
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics.charts.linecharts import HorizontalLineChart
except ImportError:
    # Графики опциональны
    Drawing = VerticalBarChart = Pie = HorizontalLineChart = None


def create_enhanced_csv_report(data: Dict[str, Any]) -> HttpResponse:
    """
    ✅ Создать красивый структурированный CSV отчет
    """
    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    filename = f'BirQadam_Analytics_Report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    writer = csv.writer(response, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    # ========== ЗАГОЛОВОК ОТЧЕТА ==========
    writer.writerow(['=' * 80])
    writer.writerow(['BirQadam - Отчет по волонтерской активности'])
    writer.writerow(['=' * 80])
    writer.writerow([])
    
    # Метаданные
    writer.writerow(['Дата создания:', data['created_at']])
    
    # ✅ Определяем название периода с поддержкой произвольных дат
    if data['period'].startswith('custom_'):
        period_display = f"Произвольный период: {data.get('date_from', 'N/A')} — {data.get('date_to', 'N/A')}"
    else:
        period_names = {'week': 'Неделя (7 дней)', 'month': 'Месяц (30 дней)', 'year': 'Год (365 дней)'}
        period_display = period_names.get(data['period'], data['period'])
    
    writer.writerow(['Период:', period_display])
    writer.writerow(['Платформа:', 'BirQadam Volunteer Management System'])
    writer.writerow([])
    writer.writerow(['=' * 80])
    writer.writerow([])
    
    # ========== ПРОЕКТЫ ==========
    if 'projects' in data and data['projects']:
        writer.writerow(['📋 СТАТУСЫ ПРОЕКТОВ'])
        writer.writerow(['-' * 40])
        writer.writerow(['Статус', 'Количество', '% от общего'])
        
        total_projects = sum(item['count'] for item in data['projects'])
        for item in data['projects']:
            percentage = (item['count'] / total_projects * 100) if total_projects > 0 else 0
            status_names = {
                'draft': 'Черновик',
                'published': 'Опубликован',
                'archived': 'Архивирован',
                'completed': 'Завершён'
            }
            writer.writerow([
                status_names.get(item['status'], item['status']),
                item['count'],
                f"{percentage:.1f}%"
            ])
        
        writer.writerow(['ИТОГО:', total_projects, '100.0%'])
        writer.writerow([])
        writer.writerow([])
    
    # ========== ЗАДАЧИ ==========
    if 'tasks' in data and data['tasks']:
        writer.writerow(['✅ СТАТУСЫ ЗАДАЧ'])
        writer.writerow(['-' * 40])
        writer.writerow(['Статус', 'Количество', '% от общего'])
        
        total_tasks = sum(item['count'] for item in data['tasks'])
        for item in data['tasks']:
            percentage = (item['count'] / total_tasks * 100) if total_tasks > 0 else 0
            status_names = {
                'pending': 'Ожидание',
                'in_progress': 'В работе',
                'completed': 'Выполнена',
                'cancelled': 'Отменена'
            }
            writer.writerow([
                status_names.get(item['status'], item['status']),
                item['count'],
                f"{percentage:.1f}%"
            ])
        
        writer.writerow(['ИТОГО:', total_tasks, '100.0%'])
        writer.writerow([])
        writer.writerow([])
    
    # ========== АКТИВНОСТЬ ПО ДНЯМ ==========
    if 'activity' in data and data['activity']:
        writer.writerow(['📈 АКТИВНОСТЬ ВОЛОНТЕРОВ ПО ДНЯМ'])
        writer.writerow(['-' * 40])
        writer.writerow(['Дата', 'Выполнено задач', 'Динамика'])
        
        prev_count = None
        for item in data['activity']:
            trend = ''
            if prev_count is not None:
                if item['count'] > prev_count:
                    trend = '↑ Рост'
                elif item['count'] < prev_count:
                    trend = '↓ Снижение'
                else:
                    trend = '→ Стабильно'
            
            writer.writerow([item['day'], item['count'], trend])
            prev_count = item['count']
        
        total_activity = sum(item['count'] for item in data['activity'])
        avg_activity = total_activity / len(data['activity']) if data['activity'] else 0
        writer.writerow([])
        writer.writerow(['Итого выполнено:', total_activity, ''])
        writer.writerow(['Среднее за день:', f"{avg_activity:.1f}", ''])
        writer.writerow([])
        writer.writerow([])
    
    # ========== РЕЙТИНГ ==========
    if 'ratings' in data and data['ratings']:
        writer.writerow(['⭐ РАСПРЕДЕЛЕНИЕ РЕЙТИНГА ВОЛОНТЁРОВ'])
        writer.writerow(['-' * 40])
        writer.writerow(['Диапазон', 'Количество', '% от общего', 'Уровень'])
        
        total_volunteers = sum(item['count'] for item in data['ratings'])
        levels = ['Начинающий', 'Активный', 'Опытный', 'Профессионал', 'Эксперт']
        
        for idx, item in enumerate(data['ratings']):
            percentage = (item['count'] / total_volunteers * 100) if total_volunteers > 0 else 0
            writer.writerow([
                item['range'],
                item['count'],
                f"{percentage:.1f}%",
                levels[idx] if idx < len(levels) else 'N/A'
            ])
        
        writer.writerow(['ИТОГО:', total_volunteers, '100.0%', ''])
        writer.writerow([])
        writer.writerow([])
    
    # ========== ВОВЛЕЧЕННОСТЬ ==========
    if 'engagement' in data:
        writer.writerow(['👥 ВОВЛЕЧЕННОСТЬ ВОЛОНТЁРОВ'])
        writer.writerow(['-' * 40])
        writer.writerow(['Категория', 'Количество', '% от общего', 'Статус'])
        
        active = data['engagement']['active']
        inactive = data['engagement']['inactive']
        total = active + inactive
        
        if total > 0:
            active_percent = (active / total * 100)
            inactive_percent = (inactive / total * 100)
        else:
            active_percent = inactive_percent = 0
        
        writer.writerow([
            'Активные волонтёры',
            active,
            f"{active_percent:.1f}%",
            '✓ Вовлечены' if active_percent >= 50 else '⚠ Низкая'
        ])
        writer.writerow([
            'Неактивные волонтёры',
            inactive,
            f"{inactive_percent:.1f}%",
            '⚠ Требует внимания' if inactive_percent > 50 else '✓ Норма'
        ])
        writer.writerow(['ИТОГО:', total, '100.0%', ''])
        writer.writerow([])
        writer.writerow([])
    
    # ========== ТОП ВОЛОНТЁРЫ ==========
    if 'top_volunteers' in data and data['top_volunteers']:
        writer.writerow(['🏆 ТОП АКТИВНЫХ ВОЛОНТЁРОВ'])
        writer.writerow(['-' * 40])
        writer.writerow(['Место', 'Имя', 'Выполнено задач', 'Достижение'])
        
        medals = ['🥇', '🥈', '🥉', '🏅', '⭐']
        achievements = ['Чемпион', 'Лидер', 'Профессионал', 'Активист', 'Помощник']
        
        for idx, volunteer in enumerate(data['top_volunteers'], 1):
            medal = medals[idx-1] if idx <= len(medals) else '•'
            achievement = achievements[idx-1] if idx <= len(achievements) else 'Участник'
            writer.writerow([
                f"{medal} #{idx}",
                volunteer['username'],
                volunteer['task_count'],
                achievement
            ])
        
        writer.writerow([])
        writer.writerow([])
    
    # ========== ФУТЕР ==========
    writer.writerow(['=' * 80])
    writer.writerow(['© 2025 BirQadam - Платформа управления волонтёрской деятельностью'])
    writer.writerow(['Создано:', datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow(['=' * 80])
    
    return response


def create_enhanced_pdf_report(data):
    """
    ✅ Создать профессиональный PDF отчет с графиками
    """
    response = HttpResponse(content_type='application/pdf')
    filename = f'BirQadam_Report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    
    # Определяем шрифты
    available_fonts = pdfmetrics.getRegisteredFontNames()
    if 'DejaVuSerif-Bold' in available_fonts:
        title_font = 'DejaVuSerif-Bold'
        text_font = 'DejaVuSerif'
    elif 'Arial-Bold' in available_fonts:
        title_font = 'Arial-Bold'
        text_font = 'Arial'
    else:
        title_font = 'VeraBd'
        text_font = 'Vera'
    
    # Стили
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='CustomTitle',
        parent=styles['Title'],
        fontName=title_font,
        fontSize=24,
        textColor=colors.HexColor('#28a745'),
        alignment=TA_CENTER,
        spaceAfter=30
    ))
    styles.add(ParagraphStyle(
        name='CustomHeading',
        parent=styles['Heading1'],
        fontName=title_font,
        fontSize=16,
        textColor=colors.HexColor('#28a745'),
        spaceBefore=20,
        spaceAfter=12
    ))
    styles.add(ParagraphStyle(
        name='CustomBody',
        parent=styles['BodyText'],
        fontName=text_font,
        fontSize=11,
        leading=14
    ))
    
    # ========== ТИТУЛЬНАЯ СТРАНИЦА ==========
    elements.append(Spacer(1, 1*inch))
    
    # Логотип/Заголовок
    title = Paragraph("BirQadam", styles['CustomTitle'])
    elements.append(title)
    
    subtitle = Paragraph(
        "Отчет по волонтёрской активности",
        ParagraphStyle(name='subtitle', parent=styles['CustomBody'], fontSize=14,
                      alignment=TA_CENTER, textColor=colors.grey)
    )
    elements.append(subtitle)
    elements.append(Spacer(1, 0.5*inch))
    
    # Информационный блок
    # ✅ Определяем название периода с поддержкой произвольных дат
    if data['period'].startswith('custom_'):
        period_display = f"Произвольный: {data.get('date_from', 'N/A')} — {data.get('date_to', 'N/A')}"
    else:
        period_names = {'week': 'Неделя', 'month': 'Месяц', 'year': 'Год'}
        period_display = period_names.get(data['period'], data['period'])
    
    info_data = [
        ['Период:', period_display],
        ['Дата создания:', data['created_at']],
        ['Система:', 'BirQadam Analytics Dashboard']
    ]
    info_table = Table(info_data, colWidths=[2*inch, 4*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), text_font),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(PageBreak())
    
    # ========== СОДЕРЖАНИЕ ==========
    
    # ========== 1. ПРОЕКТЫ ==========
    if 'projects' in data and data['projects']:
        elements.append(Paragraph("📋 СТАТУСЫ ПРОЕКТОВ", styles['CustomHeading']))
        elements.append(Spacer(1, 12))
        
        status_names = {
            'draft': 'Черновик',
            'published': 'Опубликован',
            'pending': 'На модерации',
            'approved': 'Одобрен',
            'archived': 'Архивирован',
            'completed': 'Завершён'
        }
        
        total_projects = sum(item['count'] for item in data['projects'])
        table_data = [['Статус', 'Количество', '% от общего']]
        for item in data['projects']:
            percentage = (item['count'] / total_projects * 100) if total_projects > 0 else 0
            status_value = status_names.get(item['status'], item['status'])
            table_data.append([
                str(status_value) if status_value is not None else str(item['status']),
                str(item['count']),
                f"{percentage:.1f}%"
            ])
        table_data.append(['ИТОГО:', str(total_projects), '100.0%'])
        
        table = Table(table_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#28a745')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), title_font),
            ('FONTNAME', (0, 1), (-1, -1), text_font),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -2), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e9')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#c8e6c9')),
            ('FONTNAME', (0, -1), (-1, -1), title_font),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 24))
    
    # ========== 2. ЗАДАЧИ ==========
    if 'tasks' in data and data['tasks']:
        elements.append(Paragraph("✅ СТАТУСЫ ЗАДАЧ", styles['CustomHeading']))
        elements.append(Spacer(1, 12))
        
        status_names = {
            'open': 'Открыта',
            'pending': 'Ожидание',
            'in_progress': 'В работе',
            'completed': 'Выполнена',
            'cancelled': 'Отменена',
            'failed': 'Провалена'
        }
        
        total_tasks = sum(item['count'] for item in data['tasks'])
        table_data = [['Статус', 'Количество', '% от общего']]
        for item in data['tasks']:
            percentage = (item['count'] / total_tasks * 100) if total_tasks > 0 else 0
            status_value = status_names.get(item['status'], item['status'])
            table_data.append([
                str(status_value) if status_value is not None else str(item['status']),
                str(item['count']),
                f"{percentage:.1f}%"
            ])
        table_data.append(['ИТОГО:', str(total_tasks), '100.0%'])
        
        table = Table(table_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17a2b8')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), title_font),
            ('FONTNAME', (0, 1), (-1, -1), text_font),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -2), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#d1ecf1')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#bee5eb')),
            ('FONTNAME', (0, -1), (-1, -1), title_font),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 24))
    
    # ========== 3. АКТИВНОСТЬ ==========
    if 'activity' in data and data['activity']:
        elements.append(Paragraph("📈 АКТИВНОСТЬ ВОЛОНТЁРОВ ПО ДНЯМ", styles['CustomHeading']))
        elements.append(Spacer(1, 12))
        
        total_activity = sum(item['count'] for item in data['activity'])
        avg_activity = total_activity / len(data['activity']) if data['activity'] else 0
        
        # Показываем только последние 10 дней для экономии места
        activity_slice = data['activity'][-10:] if len(data['activity']) > 10 else data['activity']
        
        table_data = [['Дата', 'Выполнено задач', 'Динамика']]
        prev_count = None
        for item in activity_slice:
            trend = ''
            if prev_count is not None:
                if item['count'] > prev_count:
                    trend = '↑ Рост'
                elif item['count'] < prev_count:
                    trend = '↓ Снижение'
                else:
                    trend = '→ Стабильно'
            
            date_str = str(item['day']) if isinstance(item['day'], str) else item['day'].strftime('%Y-%m-%d')
            table_data.append([date_str, str(item['count']), trend])
            prev_count = item['count']
        
        table_data.append(['', '', ''])
        table_data.append(['Итого выполнено:', str(total_activity), ''])
        table_data.append(['Среднее за день:', f"{avg_activity:.1f}", ''])
        
        table = Table(table_data, colWidths=[2*inch, 2*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ffc107')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), title_font),
            ('FONTNAME', (0, 1), (-1, -1), text_font),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -4), colors.white),
            ('BACKGROUND', (0, -3), (-1, -1), colors.HexColor('#fff3cd')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#ffeaa7')),
            ('FONTNAME', (0, -3), (0, -1), title_font),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 24))
    
    # ========== 4. РЕЙТИНГ ==========
    if 'ratings' in data and data['ratings']:
        elements.append(Paragraph("⭐ РАСПРЕДЕЛЕНИЕ РЕЙТИНГА ВОЛОНТЁРОВ", styles['CustomHeading']))
        elements.append(Spacer(1, 12))
        
        levels = ['Начинающий', 'Активный', 'Опытный', 'Профессионал', 'Эксперт']
        total_volunteers = sum(item['count'] for item in data['ratings'])
        
        table_data = [['Диапазон', 'Количество', '% от общего', 'Уровень']]
        for idx, item in enumerate(data['ratings']):
            percentage = (item['count'] / total_volunteers * 100) if total_volunteers > 0 else 0
            table_data.append([
                item['range'],
                str(item['count']),
                f"{percentage:.1f}%",
                levels[idx] if idx < len(levels) else 'N/A'
            ])
        table_data.append(['ИТОГО:', str(total_volunteers), '100.0%', ''])
        
        table = Table(table_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fd7e14')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), title_font),
            ('FONTNAME', (0, 1), (-1, -1), text_font),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -2), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ffe5cc')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#ffc99a')),
            ('FONTNAME', (0, -1), (-1, -1), title_font),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 24))
    
    # ========== 5. ВОВЛЕЧЕННОСТЬ ==========
    if 'engagement' in data:
        elements.append(Paragraph("👥 ВОВЛЕЧЕННОСТЬ ВОЛОНТЁРОВ", styles['CustomHeading']))
        elements.append(Spacer(1, 12))
        
        active = data['engagement']['active']
        inactive = data['engagement']['inactive']
        total = active + inactive
        
        if total > 0:
            active_percent = (active / total * 100)
            inactive_percent = (inactive / total * 100)
        else:
            active_percent = inactive_percent = 0
        
        table_data = [
            ['Категория', 'Количество', '% от общего', 'Статус'],
            [
                'Активные волонтёры',
                str(active),
                f"{active_percent:.1f}%",
                '✓ Вовлечены' if active_percent >= 50 else '⚠ Низкая'
            ],
            [
                'Неактивные волонтёры',
                str(inactive),
                f"{inactive_percent:.1f}%",
                '⚠ Требует внимания' if inactive_percent > 50 else '✓ Норма'
            ],
            ['ИТОГО:', str(total), '100.0%', '']
        ]
        
        table = Table(table_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6f42c1')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), title_font),
            ('FONTNAME', (0, 1), (-1, -1), text_font),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -2), colors.white),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e7d9f5')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1b3ea')),
            ('FONTNAME', (0, -1), (-1, -1), title_font),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 24))
    
    # ========== 6. ТОП ВОЛОНТЁРЫ ==========
    if 'top_volunteers' in data and data['top_volunteers']:
        elements.append(Paragraph("🏆 ТОП АКТИВНЫХ ВОЛОНТЁРОВ", styles['CustomHeading']))
        elements.append(Spacer(1, 12))
        
        medals = ['🥇', '🥈', '🥉', '🏅', '⭐']
        achievements = ['Чемпион', 'Лидер', 'Профессионал', 'Активист', 'Помощник']
        
        table_data = [['Место', 'Имя', 'Выполнено задач', 'Достижение']]
        for idx, volunteer in enumerate(data['top_volunteers'], 1):
            medal = medals[idx-1] if idx <= len(medals) else '•'
            achievement = achievements[idx-1] if idx <= len(achievements) else 'Участник'
            table_data.append([
                f"{medal} #{idx}",
                volunteer['username'],
                str(volunteer['task_count']),
                achievement
            ])
        
        table = Table(table_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc3545')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), title_font),
            ('FONTNAME', (0, 1), (-1, -1), text_font),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#f5c6cb')),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 24))
    
    # ========== ФУТЕР ==========
    elements.append(Spacer(1, 1*inch))
    footer = Paragraph(
        "© 2025 BirQadam - Платформа управления волонтёрской деятельностью<br/>"
        f"Создано: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        ParagraphStyle(name='footer', parent=styles['CustomBody'], fontSize=9,
                      alignment=TA_CENTER, textColor=colors.grey)
    )
    elements.append(footer)
    
    # Строим PDF
    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    response.write(pdf)
    
    return response

