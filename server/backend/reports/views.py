import logging

from django.db.models import F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .serializers import UserReportSerializer, CreateReportSerializer
from . import services

logger = logging.getLogger(__name__)


class UserReportViewSet(viewsets.ViewSet):
    def list(self, request):
        reports = services.get_active_reports()
        serializer = UserReportSerializer(reports, many=True)
        return Response(serializer.data)

    def create(self, request):
        idempotency_key = request.headers.get('Idempotency-Key', '')
        serializer = CreateReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        report, created = services.create_report(
            serializer.validated_data,
            idempotency_key,
        )
        out = UserReportSerializer(report)
        return Response(
            out.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        updated = services.get_active_reports().filter(pk=pk).update(
            upvotes=F('upvotes') + 1
        )
        if not updated:
            return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)
        report = services.get_active_reports().get(pk=pk)
        return Response(UserReportSerializer(report).data)

    @action(detail=True, methods=['post'])
    def downvote(self, request, pk=None):
        updated = services.get_active_reports().filter(pk=pk).update(
            downvotes=F('downvotes') + 1
        )
        if not updated:
            return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)
        report = services.get_active_reports().get(pk=pk)
        return Response(UserReportSerializer(report).data)
