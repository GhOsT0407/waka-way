from django.contrib import admin
try:
    from django.contrib.gis.admin import OSMGeoAdmin
    POSTGIS_AVAILABLE = True
except Exception:
    OSMGeoAdmin = admin.ModelAdmin
    POSTGIS_AVAILABLE = False

from .models import (
    City, TransportStop, TransportRoute, RouteSegment,
    Fare, RouteSuggestion, RouteStep, UserReport,
    UserFavoritePlace, UserRouteHistory
)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name', 'state', 'country', 'is_active')
    list_filter = ('is_active', 'state')
    search_fields = ('name', 'state')


@admin.register(TransportStop)
class TransportStopAdmin(OSMGeoAdmin):
    list_display = ('name', 'stop_type', 'city', 'is_verified')
    list_filter = ('stop_type', 'is_verified', 'city')
    search_fields = ('name', 'address', 'landmark')
    default_lon = 3.3792  # Lagos longitude
    default_lat = 6.5244  # Lagos latitude
    default_zoom = 11


@admin.register(TransportRoute)
class TransportRouteAdmin(admin.ModelAdmin):
    list_display = ('name', 'route_number', 'transport_mode', 'city', 'is_active')
    list_filter = ('transport_mode', 'is_active', 'city')
    search_fields = ('name', 'route_number')


@admin.register(RouteSegment)
class RouteSegmentAdmin(admin.ModelAdmin):
    list_display = ('route', 'stop', 'sequence', 'estimated_time_minutes', 'distance_km')
    list_filter = ('route',)
    ordering = ('route', 'sequence')


@admin.register(Fare)
class FareAdmin(admin.ModelAdmin):
    list_display = ('route', 'amount_ngn', 'currency', 'is_verified')
    list_filter = ('is_verified', 'currency')
    search_fields = ('route__name',)


@admin.register(RouteSuggestion)
class RouteSuggestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'city', 'total_time_minutes', 'total_fare_ngn', 'view_count')
    list_filter = ('city',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(RouteStep)
class RouteStepAdmin(admin.ModelAdmin):
    list_display = ('suggestion', 'sequence', 'transport_mode', 'instruction', 'duration_minutes')
    list_filter = ('transport_mode',)
    ordering = ('suggestion', 'sequence')


@admin.register(UserReport)
class UserReportAdmin(admin.ModelAdmin):
    list_display = ('title', 'report_type', 'status', 'upvotes', 'downvotes', 'created_at')
    list_filter = ('report_type', 'status', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at', 'updated_at', 'verified_at')


@admin.register(UserFavoritePlace)
class UserFavoritePlaceAdmin(OSMGeoAdmin):
    list_display = ('name', 'user', 'user_device_id', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'address')
    default_lon = 3.3792
    default_lat = 6.5244
    default_zoom = 11


@admin.register(UserRouteHistory)
class UserRouteHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'user_device_id', 'origin_name', 'destination_name', 'searched_at')
    list_filter = ('searched_at',)
    search_fields = ('origin_name', 'destination_name')
    readonly_fields = ('searched_at',)
