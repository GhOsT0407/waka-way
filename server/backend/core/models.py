from django.db import models
# Temporarily disable PostGIS imports until GDAL is installed
try:
    from django.contrib.gis.db import models as gis_models
    POSTGIS_AVAILABLE = True
except Exception:
    # Fallback to regular models if PostGIS not available
    POSTGIS_AVAILABLE = False
    # Create dummy field classes that use JSONField instead
    class _PointField(models.JSONField):
        def __init__(self, *args, **kwargs):
            kwargs.pop('srid', None)  # Remove srid argument
            super().__init__(*args, **kwargs)
    
    class _LineStringField(models.JSONField):
        def __init__(self, *args, **kwargs):
            kwargs.pop('srid', None)
            super().__init__(*args, **kwargs)
    
    class _PolygonField(models.JSONField):
        def __init__(self, *args, **kwargs):
            kwargs.pop('srid', None)
            super().__init__(*args, **kwargs)
    
    gis_models = type('models', (), {
        'PointField': _PointField,
        'LineStringField': _LineStringField,
        'PolygonField': _PolygonField,
    })()

from django.contrib.auth.models import User


class City(models.Model):
    """Represents a city where WakaWay operates"""
    name = models.CharField(max_length=100)  # e.g., "Lagos", "Abuja"
    state = models.CharField(max_length=100)  # e.g., "Lagos State", "FCT"
    country = models.CharField(max_length=100, default="Nigeria")
    bounds = gis_models.PolygonField(null=True, blank=True)  # City boundaries (PostGIS or JSON)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Cities"
        indexes = [
            models.Index(fields=['name', 'state']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name}, {self.state}"


class TransportStop(models.Model):
    """Represents bus stops, keke parks, okada stands, etc."""
    STOP_TYPES = [
        ('bus', 'Bus Stop'),
        ('keke', 'Keke Park'),
        ('okada', 'Okada Stand'),
        ('walk', 'Walking Point'),
        ('junction', 'Junction'),
    ]

    name = models.CharField(max_length=200)  # e.g., "Ikeja Bus Stop"
    stop_type = models.CharField(max_length=20, choices=STOP_TYPES)
    location = gis_models.PointField(default=dict)  # PostGIS Point or JSON: {"lat": 6.5244, "lng": 3.3792}
    address = models.TextField(blank=True)
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='stops')
    landmark = models.CharField(max_length=200, blank=True)  # Nearby landmark
    is_verified = models.BooleanField(default=False)
    verification_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['stop_type', 'city']),
            models.Index(fields=['is_verified']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_stop_type_display()})"


class TransportRoute(models.Model):
    """Represents a transport route between stops"""
    TRANSPORT_MODES = [
        ('bus', 'Bus/Danfo'),
        ('keke', 'Keke/Tricycle'),
        ('okada', 'Okada/Motorbike'),
        ('walk', 'Walking'),
    ]

    route_number = models.CharField(max_length=50, blank=True)  # e.g., "47", "BRT 1"
    transport_mode = models.CharField(max_length=20, choices=TRANSPORT_MODES)
    name = models.CharField(max_length=200)  # e.g., "Ikeja - Oshodi"
    origin_stop = models.ForeignKey(
        TransportStop,
        on_delete=models.CASCADE,
        related_name='routes_from'
    )
    destination_stop = models.ForeignKey(
        TransportStop,
        on_delete=models.CASCADE,
        related_name='routes_to'
    )
    path = gis_models.LineStringField(blank=True, null=True)  # Route path (PostGIS or JSON)
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='routes')

    # Operational details
    is_active = models.BooleanField(default=True)
    operating_hours_start = models.TimeField(blank=True, null=True)
    operating_hours_end = models.TimeField(blank=True, null=True)
    frequency_minutes = models.IntegerField(blank=True, null=True)  # Average wait time

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['transport_mode', 'city']),
            models.Index(fields=['is_active']),
            models.Index(fields=['origin_stop', 'destination_stop']),
        ]

    def __str__(self):
        if self.route_number:
            return f"{self.transport_mode} #{self.route_number}: {self.name}"
        return f"{self.transport_mode}: {self.name}"


class RouteSegment(models.Model):
    """Represents a segment of a route with intermediate stops"""
    route = models.ForeignKey(TransportRoute, on_delete=models.CASCADE, related_name='segments')
    stop = models.ForeignKey(TransportStop, on_delete=models.CASCADE, related_name='segments')
    sequence = models.IntegerField()  # Order in the route
    estimated_time_minutes = models.IntegerField(default=0)
    distance_km = models.FloatField(default=0.0)

    class Meta:
        unique_together = ['route', 'sequence']
        ordering = ['route', 'sequence']
        indexes = [
            models.Index(fields=['route', 'sequence']),
        ]

    def __str__(self):
        return f"{self.route} - Stop {self.sequence}"


class Fare(models.Model):
    """Stores fare information for routes"""
    route = models.ForeignKey(TransportRoute, on_delete=models.CASCADE, related_name='fares')
    origin_stop = models.ForeignKey(
        TransportStop,
        on_delete=models.CASCADE,
        related_name='fares_from',
        blank=True,
        null=True
    )
    destination_stop = models.ForeignKey(
        TransportStop,
        on_delete=models.CASCADE,
        related_name='fares_to',
        blank=True,
        null=True
    )

    # Fare details
    amount_ngn = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='NGN')

    # Validation
    is_verified = models.BooleanField(default=False)
    report_count = models.IntegerField(default=0)
    last_verified = models.DateTimeField(blank=True, null=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['route', 'is_verified']),
            models.Index(fields=['amount_ngn']),
        ]

    def __str__(self):
        return f"₦{self.amount_ngn} - {self.route}"


class RouteSuggestion(models.Model):
    """Stored route suggestions from origin to destination"""
    origin = gis_models.PointField(default=dict)  # PostGIS Point or JSON
    destination = gis_models.PointField(default=dict)  # PostGIS Point or JSON
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='suggestions')

    # Route details
    total_time_minutes = models.IntegerField()
    total_distance_km = models.FloatField()
    total_fare_ngn = models.DecimalField(max_digits=10, decimal_places=2)
    path = gis_models.LineStringField(null=True, blank=True)  # PostGIS or JSON

    # Steps (stored as JSON)
    steps = models.JSONField(default=list)

    # Popularity
    view_count = models.IntegerField(default=0)
    favorite_count = models.IntegerField(default=0)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['city', 'created_at']),
            models.Index(fields=['view_count']),
        ]

    def __str__(self):
        return f"Route: {self.total_time_minutes} mins, ₦{self.total_fare_ngn}"


class RouteStep(models.Model):
    """Individual steps within a route suggestion"""
    suggestion = models.ForeignKey(
        RouteSuggestion,
        on_delete=models.CASCADE,
        related_name='route_steps'
    )
    sequence = models.IntegerField()

    transport_mode = models.CharField(max_length=20, choices=TransportRoute.TRANSPORT_MODES)
    route = models.ForeignKey(
        TransportRoute,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='steps'
    )

    # Step details
    instruction = models.TextField()
    start_location = gis_models.PointField(default=dict)  # PostGIS Point or JSON
    end_location = gis_models.PointField(default=dict)  # PostGIS Point or JSON
    distance_km = models.FloatField()
    duration_minutes = models.IntegerField()
    fare_ngn = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Intermediate stops
    intermediate_stops = models.ManyToManyField(TransportStop, blank=True)

    class Meta:
        unique_together = ['suggestion', 'sequence']
        ordering = ['suggestion', 'sequence']
        indexes = [
            models.Index(fields=['suggestion', 'sequence']),
        ]

    def __str__(self):
        return f"Step {self.sequence}: {self.instruction}"


class UserReport(models.Model):
    """Crowdsourced reports from users"""
    REPORT_TYPES = [
        ('fare_update', 'Fare Update'),
        ('route_disrupted', 'Route Disrupted'),
        ('new_route', 'New Route Available'),
        ('stop_moved', 'Stop Location Changed'),
        ('route_wrong', 'Route Information Incorrect'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
        ('resolved', 'Resolved'),
    ]

    report_type = models.CharField(max_length=30, choices=REPORT_TYPES)

    # Related entities
    route = models.ForeignKey(
        TransportRoute,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports'
    )
    stop = models.ForeignKey(
        TransportStop,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports'
    )
    fare = models.ForeignKey(
        Fare,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports'
    )

    # Report details
    title = models.CharField(max_length=200)
    description = models.TextField()
    location = gis_models.PointField(blank=True, null=True)  # PostGIS Point or JSON

    # Updated information
    new_fare_ngn = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    new_location = gis_models.PointField(blank=True, null=True)  # PostGIS Point or JSON

    # Verification
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    upvotes = models.IntegerField(default=0)
    downvotes = models.IntegerField(default=0)

    # User info
    user_device_id = models.CharField(max_length=200, blank=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['report_type', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"{self.get_report_type_display()}: {self.title}"


class UserFavoritePlace(models.Model):
    """User's saved favorite places"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    user_device_id = models.CharField(max_length=200, blank=True)

    name = models.CharField(max_length=200)
    location = gis_models.PointField(default=dict)  # PostGIS Point or JSON
    address = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['user_device_id']),
        ]

    def __str__(self):
        return f"{self.name} ({self.user or self.user_device_id})"


class UserRouteHistory(models.Model):
    """Track user's route search history"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    user_device_id = models.CharField(max_length=200, blank=True)

    origin = gis_models.PointField(default=dict)  # PostGIS Point or JSON
    destination = gis_models.PointField(default=dict)  # PostGIS Point or JSON
    origin_name = models.CharField(max_length=200, blank=True)
    destination_name = models.CharField(max_length=200, blank=True)

    route_suggestion = models.ForeignKey(
        RouteSuggestion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    searched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-searched_at']
        indexes = [
            models.Index(fields=['user', '-searched_at']),
            models.Index(fields=['user_device_id', '-searched_at']),
        ]

    def __str__(self):
        return f"Route search at {self.searched_at}"


class Corridor(models.Model):
    """
    Represents a major transportation corridor in Lagos with multiple stops.
    A corridor is a named route with a primary mode of transport (e.g., Danfo, BRT).
    """
    corridor_id = models.CharField(max_length=50, unique=True)  # e.g., "C001"
    name = models.CharField(max_length=250)  # e.g., "Ikorodu - Mile 12 Local"
    description = models.TextField(blank=True)  # Extended description
    
    primary_mode = models.CharField(
        max_length=20,
        choices=[
            ('danfo', 'Danfo/Minibus'),
            ('brt', 'BRT (Bus Rapid Transit)'),
            ('keke', 'Keke/Tricycle'),
            ('okada', 'Okada/Motorcycle'),
            ('ferry', 'Ferry'),
            ('walk', 'Walking'),
            ('mixed', 'Mixed Modes'),
        ]
    )
    
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='corridors')
    
    # Route characteristics
    is_active = models.BooleanField(default=True)
    operating_hours_start = models.TimeField(blank=True, null=True)
    operating_hours_end = models.TimeField(blank=True, null=True)
    
    # Additional info
    notes = models.TextField(blank=True)  # Route-specific notes (e.g., "banned danfo on Lekki-Epe Expressway")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['city', 'primary_mode']),
            models.Index(fields=['is_active']),
        ]
        verbose_name_plural = "Corridors"
    
    def __str__(self):
        return f"{self.corridor_id}: {self.name}"


class CorridorStop(models.Model):
    """
    Represents a stop within a corridor in sequence.
    Includes the position and characteristics of stops along the corridor.
    """
    STOP_TYPES = [
        ('major_park', 'Major Park'),
        ('major_interchange', 'Major Interchange'),
        ('bus_stop', 'Bus Stop'),
        ('major_bus_stop', 'Major Bus Stop'),
        ('junction', 'Junction'),
        ('major_junction', 'Major Junction'),
        ('terminal', 'Terminal'),
        ('major_terminal', 'Major Terminal'),
    ]
    
    corridor = models.ForeignKey(Corridor, on_delete=models.CASCADE, related_name='corridor_stops')
    stop = models.ForeignKey(TransportStop, on_delete=models.CASCADE, related_name='corridor_positions')
    
    # Position in the corridor
    sequence = models.IntegerField()  # Order within corridor (0, 1, 2, ...)
    
    # Stop details specific to this corridor
    stop_type = models.CharField(max_length=20, choices=STOP_TYPES)
    
    # Operational details
    estimated_time_from_previous = models.IntegerField(
        default=0,
        help_text="Estimated travel time from previous stop in minutes"
    )
    
    class Meta:
        unique_together = ['corridor', 'sequence']
        ordering = ['corridor', 'sequence']
        indexes = [
            models.Index(fields=['corridor', 'sequence']),
        ]
    
    def __str__(self):
        return f"{self.corridor.name} - Stop {self.sequence}: {self.stop.name}"


class StopConnection(models.Model):
    """
    Represents an alternative transport connection from one stop to another.
    Track secondary connections like "Keke to X" or "Okada to Y" from a main corridor stop.
    """
    from_stop = models.ForeignKey(
        TransportStop,
        on_delete=models.CASCADE,
        related_name='connections_from'
    )
    to_stop = models.ForeignKey(
        TransportStop,
        on_delete=models.CASCADE,
        related_name='connections_to'
    )
    
    # Transport mode for this connection
    transport_mode = models.CharField(
        max_length=20,
        choices=[
            ('danfo', 'Danfo/Minibus'),
            ('brt', 'BRT'),
            ('keke', 'Keke/Tricycle'),
            ('okada', 'Okada/Motorcycle'),
            ('ferry', 'Ferry'),
            ('walk', 'Walking'),
        ]
    )
    
    # Corridor context (optional - the corridor this connection belongs to)
    corridor = models.ForeignKey(
        Corridor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='connections'
    )
    
    # Route/connection characteristics
    estimated_time_minutes = models.IntegerField(default=5)
    distance_km = models.FloatField(default=0.0)
    is_verified = models.BooleanField(default=False)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['from_stop', 'to_stop', 'transport_mode']
        indexes = [
            models.Index(fields=['from_stop', 'transport_mode']),
            models.Index(fields=['corridor']),
        ]
    
    def __str__(self):
        return f"{self.from_stop.name} → {self.to_stop.name} ({self.transport_mode})"
