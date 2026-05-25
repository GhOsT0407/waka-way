from core.models import Corridor, CorridorStop, StopConnection


def get_corridors_queryset():
    return Corridor.objects.prefetch_related(
        'corridor_stops__stop',
        'connections',
    )


def get_corridor_stops_queryset():
    return CorridorStop.objects.select_related(
        'corridor', 'stop'
    ).order_by('corridor', 'sequence')


def get_stop_connections_queryset():
    return StopConnection.objects.select_related(
        'from_stop', 'to_stop', 'corridor'
    )
