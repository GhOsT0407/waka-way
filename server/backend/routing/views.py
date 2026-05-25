import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import AnonRateThrottle

logger = logging.getLogger(__name__)

from .serializers import RouteComputeRequestSerializer
from . import services


class RouteComputeThrottle(AnonRateThrottle):
    scope = 'route_compute'


class RouteComputeView(APIView):
    throttle_classes = [RouteComputeThrottle]

    def post(self, request):
        serializer = RouteComputeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = services.compute_route(serializer.validated_data)
            return Response(result)
        except Exception:
            logger.exception("Route computation failed")
            return Response(
                {'error': 'Route computation failed'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
