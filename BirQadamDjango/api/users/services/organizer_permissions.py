"""
Единая проверка прав одобренного организатора для веб-портала и admin API.
"""
from __future__ import annotations


def is_approved_organizer(user) -> bool:
    is_organizer = getattr(user, 'is_organizer', False) or getattr(user, 'role', None) == 'organizer'
    organizer_status = getattr(user, 'organizer_status', None)
    is_approved = getattr(user, 'is_approved', False)
    return bool(is_organizer and (is_approved or organizer_status == 'approved'))
