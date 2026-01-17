# WakaWay - Database Schema Documentation

## Overview

This document outlines the database schema for WakaWay using PostgreSQL with PostGIS extension for geospatial data storage and queries.

---

## Database Models

### 1. City Model
Stores information about cities where WakaWay operates.

```python
class City(models.Model):
    name = models.CharField(max_length=100)  # e.g., "Lagos", "Abuja"
    state = models.CharField(max_length=100)  # e.g., "Lagos State", "FCT"
    country = models.CharField(max_length=100, default="Nigeria")
    bounds = models.PolygonField()  # City boundaries (PostGIS)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Cities"
        indexes = [
            models.Index(fields=['name', 'state']),
            models.Index(fields=['is_active']),
        ]
```

---

### 2. TransportStop Model
Represents bus stops, keke parks, okada stands, etc.

```python
class TransportStop(models.Model):
    STOP_TYPES = [
        ('bus', 'Bus Stop'),
        ('keke', 'Keke Park'),
        ('okada', 'Okada Stand'),
        ('walk', 'Walking Point'),
        ('junction', 'Junction'),
    ]
    
    name = models.CharField(max_length=200)  # e.g., "Ikeja Bus Stop"
    stop_type = models.CharField(max_length=20, choices=STOP_TYPES)
    location = models.PointField(srid=4326)  # PostGIS Point (lat/lng)
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
            models.Index(fields=['city', 'location']),  # For spatial queries
        ]
```

---

### 3. TransportRoute Model
Represents a transport route between stops (e.g., Bus Route #47).

```python
class TransportRoute(models.Model):
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
    path = models.LineStringField(srid=4326, blank=True, null=True)  # Route path (PostGIS)
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='routes')
    
    # Operational details
    is_active = models.BooleanField(default=True)
    operating_hours_start = models.TimeField(blank=True, null=True)  # e.g., 06:00
    operating_hours_end = models.TimeField(blank=True, null=True)  # e.g., 22:00
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
```

---

### 4. RouteSegment Model
Represents a segment of a route with intermediate stops.

```python
class RouteSegment(models.Model):
    route = models.ForeignKey(TransportRoute, on_delete=models.CASCADE, related_name='segments')
    stop = models.ForeignKey(TransportStop, on_delete=models.CASCADE, related_name='segments')
    sequence = models.IntegerField()  # Order in the route (0, 1, 2, ...)
    estimated_time_minutes = models.IntegerField(default=0)  # Time from previous stop
    distance_km = models.FloatField(default=0.0)  # Distance from previous stop
    
    class Meta:
        unique_together = ['route', 'sequence']
        ordering = ['route', 'sequence']
        indexes = [
            models.Index(fields=['route', 'sequence']),
        ]
```

---

### 5. Fare Model
Stores fare information for routes.

```python
class Fare(models.Model):
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
    amount_ngn = models.DecimalField(max_digits=10, decimal_places=2)  # e.g., 100.00
    currency = models.CharField(max_length=3, default='NGN')
    
    # Validation
    is_verified = models.BooleanField(default=False)
    report_count = models.IntegerField(default=0)  # Number of user reports
    last_verified = models.DateTimeField(blank=True, null=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['route', 'is_verified']),
            models.Index(fields=['amount_ngn']),
        ]
```

---

### 6. RouteSuggestion Model
Stored route suggestions from origin to destination.

```python
class RouteSuggestion(models.Model):
    origin = models.PointField(srid=4326)  # User's origin location
    destination = models.PointField(srid=4326)  # User's destination location
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='suggestions')
    
    # Route details
    total_time_minutes = models.IntegerField()
    total_distance_km = models.FloatField()
    total_fare_ngn = models.DecimalField(max_digits=10, decimal_places=2)
    path = models.LineStringField(srid=4326)  # Complete route path
    
    # Steps (stored as JSON)
    steps = models.JSONField()  # Array of route steps
    
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
```

---

### 7. RouteStep Model
Individual steps within a route suggestion.

```python
class RouteStep(models.Model):
    suggestion = models.ForeignKey(
        RouteSuggestion, 
        on_delete=models.CASCADE, 
        related_name='route_steps'
    )
    sequence = models.IntegerField()  # Step order (0, 1, 2, ...)
    
    transport_mode = models.CharField(max_length=20, choices=TransportRoute.TRANSPORT_MODES)
    route = models.ForeignKey(
        TransportRoute, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='steps'
    )
    
    # Step details
    instruction = models.TextField()  # e.g., "Take Bus #47 to Oshodi"
    start_location = models.PointField(srid=4326)
    end_location = models.PointField(srid=4326)
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
```

---

### 8. UserReport Model
Crowdsourced reports from users about routes, fares, stops.

```python
class UserReport(models.Model):
    REPORT_TYPES = [
        ('fare_update', 'Fare Update'),
        ('route_disrupted', 'Route Disrupted'),
        ('new_route', 'New Route Available'),
        ('stop_moved', 'Stop Location Changed'),
        ('route_wrong', 'Route Information Incorrect'),
        ('other', 'Other'),
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
    location = models.PointField(srid=4326, blank=True, null=True)
    
    # Updated information (for fare updates, etc.)
    new_fare_ngn = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True
    )
    new_location = models.PointField(srid=4326, blank=True, null=True)
    
    # Verification
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('verified', 'Verified'),
            ('rejected', 'Rejected'),
            ('resolved', 'Resolved'),
        ],
        default='pending'
    )
    upvotes = models.IntegerField(default=0)
    downvotes = models.IntegerField(default=0)
    
    # User info (anonymous or authenticated)
    user_device_id = models.CharField(max_length=200, blank=True)  # For anonymous users
    user = models.ForeignKey(
        'auth.User', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )  # For authenticated users
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['report_type', 'status']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['route', 'status']),
            models.Index(fields=['stop', 'status']),
        ]
```

---

### 9. UserFavoritePlace Model
User's saved favorite places/destinations.

```python
class UserFavoritePlace(models.Model):
    user = models.ForeignKey(
        'auth.User', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True
    )
    user_device_id = models.CharField(max_length=200, blank=True)  # For anonymous users
    
    name = models.CharField(max_length=200)  # e.g., "Home", "Office", "Ikeja Mall"
    location = models.PointField(srid=4326)
    address = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['user_device_id']),
        ]
```

---

### 10. UserRouteHistory Model
Track user's route search history.

```python
class UserRouteHistory(models.Model):
    user = models.ForeignKey(
        'auth.User', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True
    )
    user_device_id = models.CharField(max_length=200, blank=True)  # For anonymous users
    
    origin = models.PointField(srid=4326)
    destination = models.PointField(srid=4326)
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
```

---

## Database Relationships Diagram

```
City
  ├── TransportStop (many)
  ├── TransportRoute (many)
  └── RouteSuggestion (many)

TransportStop
  ├── TransportRoute (origin_stop, destination_stop)
  ├── RouteSegment (many)
  ├── Fare (origin_stop, destination_stop)
  ├── RouteStep (intermediate_stops - M2M)
  ├── UserReport (many)
  └── UserFavoritePlace (via location)

TransportRoute
  ├── RouteSegment (many)
  ├── Fare (many)
  ├── RouteStep (many)
  └── UserReport (many)

RouteSuggestion
  └── RouteStep (many)

Fare
  └── UserReport (many)

User (auth.User)
  ├── UserReport (many)
  ├── UserFavoritePlace (many)
  └── UserRouteHistory (many)
```

---

## PostGIS Setup

### Installation

```bash
# Install PostGIS extension
sudo apt-get install postgresql-postgis  # Ubuntu/Debian
# or
brew install postgis  # macOS
```

### Django Configuration

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'django.contrib.gis',
    # ...
]

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'wakaway_db',
        'USER': 'your_user',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### Spatial Indexes

PostGIS automatically creates spatial indexes for PointField, LineStringField, and PolygonField. Additional indexes are recommended:

```python
# In migrations or model Meta
indexes = [
    models.Index(fields=['location']),  # For PointField
    models.Index(fields=['path']),  # For LineStringField
]
```

---

## Sample Queries

### Find nearest transport stops

```python
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

user_location = Point(lng, lat, srid=4326)
stops = TransportStop.objects.filter(
    location__distance_lte=(user_location, D(km=1))  # Within 1km
).distance(user_location).order_by('distance')[:10]
```

### Calculate route distance

```python
from django.contrib.gis.geos import LineString

route_points = [...]  # List of Point objects
route_path = LineString(route_points, srid=4326)
distance_km = route_path.length / 1000  # Convert meters to km
```

### Find routes in area

```python
from django.contrib.gis.geos import Polygon

city_bounds = Polygon(...)  # City boundary polygon
routes = TransportRoute.objects.filter(path__intersects=city_bounds)
```

---

## Data Migration Strategy

### Initial Data Collection

1. **Manual Collection (MVP)**:
   - Collect route data from local transport authorities
   - Survey popular routes in Lagos/Abuja
   - Manually input stops and routes

2. **Crowdsourcing (Phase 2)**:
   - Allow users to report routes and stops
   - Verify user reports before adding to database
   - Implement upvote/downvote system

### Sample Data Script

```python
# management/commands/import_lagos_routes.py
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from core.models import City, TransportStop, TransportRoute

class Command(BaseCommand):
    def handle(self, *args, **options):
        # Create Lagos city
        lagos = City.objects.create(
            name="Lagos",
            state="Lagos State",
            bounds=Polygon(...)  # Lagos boundaries
        )
        
        # Create stops
        ikeja_stop = TransportStop.objects.create(
            name="Ikeja Bus Stop",
            stop_type="bus",
            location=Point(3.3499, 6.5244, srid=4326),  # lat, lng
            city=lagos
        )
        
        # Create routes
        # ...
```

---

## Performance Optimization

1. **Spatial Indexing**: PostGIS automatically indexes geometry fields
2. **Query Optimization**: Use `select_related()` and `prefetch_related()` for joins
3. **Caching**: Cache frequently accessed routes and stops
4. **Pagination**: Limit query results for API endpoints
5. **Materialized Views**: For complex route calculations (future)

---

## Security Considerations

1. **Location Privacy**: Store only necessary location data
2. **User Anonymity**: Support anonymous users via device_id
3. **Input Validation**: Validate all user inputs, especially coordinates
4. **Rate Limiting**: Prevent spam reports
5. **Data Verification**: Verify user reports before making them public

