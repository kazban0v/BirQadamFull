from typing import Any
from django import forms
import django_filters
from django.db.models import Q, QuerySet
from core.models import User, Project, Task

class UserFilter(django_filters.FilterSet):
    username = django_filters.CharFilter(lookup_expr='icontains', label='Имя пользователя')
    rating = django_filters.RangeFilter(label='Рейтинг (от и до)')
    
    class Meta:
        model = User
        fields = ['username', 'rating']

class ProjectFilter(django_filters.FilterSet):
    title = django_filters.CharFilter(lookup_expr='icontains', label='Название проекта')
    city = django_filters.CharFilter(lookup_expr='icontains', label='Город')
    status = django_filters.ChoiceFilter(choices=Project.STATUS_CHOICES, label='Статус')
    
    class Meta:
        model = Project
        fields = ['title', 'city', 'status']

class TaskFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(
        method='filter_search',
        label='Поиск',
        widget=forms.TextInput(attrs={
            'placeholder': 'Поиск по тексту или проекту',
            'class': 'form-control'
        })
    )
    
    status = django_filters.ChoiceFilter(
        choices=Task.STATUS_CHOICES,
        label='Статус',
        empty_label="Все статусы",
        widget=forms.Select(attrs={
            'class': 'form-select'
        })
    )
    
    date_from = django_filters.DateFilter(
        field_name='created_at',
        lookup_expr='gte',
        label='Дата создания (от)',
        widget=forms.DateInput(attrs={
            'type': 'date',
            'class': 'form-control'
        })
    )

    class Meta:
        model = Task
        fields = ['search', 'status', 'date_from']

    def filter_search(self, queryset: QuerySet[Task], name: str, value: Any) -> QuerySet[Task]:  # type: ignore[no-any-unimported]
        if value:
            return queryset.filter(
                Q(text__icontains=value) | 
                Q(project__title__icontains=value)
            )
        return queryset