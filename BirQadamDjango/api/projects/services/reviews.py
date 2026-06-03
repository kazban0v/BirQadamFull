from __future__ import annotations

from django.db import transaction

from api.projects.models import VolunteerReview


def create_or_update_volunteer_review(
    *,
    volunteer,
    organizer,
    project,
    rating: int,
    text: str,
    task=None,
    photo=None,
) -> VolunteerReview:
    text = (text or '').strip()
    if len(text) < 10:
        raise ValueError('Текст отзыва должен содержать минимум 10 символов.')

    with transaction.atomic():
        review, _created = VolunteerReview.objects.update_or_create(
            organizer=organizer,
            volunteer=volunteer,
            project=project,
            defaults={
                'rating': rating,
                'text': text[:2000],
                'task': task,
                'photo': photo,
                'is_published': True,
            },
        )
    return review


def volunteer_has_completed_work_on_project(volunteer, project) -> bool:
    from api.tasks.models import TaskAssignment

    return TaskAssignment.objects.filter(
        volunteer=volunteer,
        completed=True,
        task__project=project,
        task__is_deleted=False,
    ).exists()
