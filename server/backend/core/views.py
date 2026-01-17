from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


@api_view(['GET'])
def api_root(request):
    """API root endpoint"""
    return Response({
        'message': 'Welcome to WakaWay API',
        'version': '1.0',
        'endpoints': {
            'cities': '/api/v1/cities/',
            'stops': '/api/v1/stops/',
            'routes': '/api/v1/routes/',
            'search': '/api/v1/routes/search/',
            'reports': '/api/v1/reports/',
        }
    })


@api_view(['GET'])
def health_check(request):
    """Health check endpoint"""
    return Response({
        'status': 'healthy',
        'message': 'WakaWay API is running'
    })
