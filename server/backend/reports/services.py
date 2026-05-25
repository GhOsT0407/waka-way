from django.utils import timezone
from core.models import UserReport


def get_active_reports():
    return UserReport.objects.filter(
        deleted_at__isnull=True
    ).order_by('-created_at')


def create_report(data: dict, idempotency_key: str = '') -> tuple[UserReport, bool]:
    """
    Returns (report, created). If the idempotency_key matches an existing
    non-deleted report, returns that report and False instead of creating a duplicate.
    """
    if idempotency_key:
        existing = UserReport.objects.filter(
            idempotency_key=idempotency_key,
            deleted_at__isnull=True,
        ).first()
        if existing:
            return existing, False

    report = UserReport.objects.create(
        idempotency_key=idempotency_key,
        **data,
    )
    return report, True


def soft_delete_report(report_id: int) -> None:
    UserReport.objects.filter(pk=report_id).update(deleted_at=timezone.now())
