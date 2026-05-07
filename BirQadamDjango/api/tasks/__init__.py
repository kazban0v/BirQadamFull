"""
Tasks domain module
Содержит модели и логику, связанную с задачами
"""
from .models import Task, TaskAssignment, Photo

__all__ = [
    'Task',
    'TaskAssignment',
    'Photo',
]
