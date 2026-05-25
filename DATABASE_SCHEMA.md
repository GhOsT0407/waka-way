# WakaWay — Database Schema

## Overview

The backend uses Django ORM with **SQLite in development** and targets PostgreSQL + PostGIS in production. Geometry fields (`PointField`, `LineStringField`, `PolygonField`) fall back to `JSONField` when PostGIS/GDAL is not installed, so the app works on Windows without a spatial database during dev.

Migrations applied:
- `0001_initial` — all 10 core models
- `0002_corridor_models` — Corridor, CorridorStop, StopConnection
- `0003_soft_deletes_and_idempotency` — `deleted_at` on UserReport + UserFavoritePlace, `idempotency_key` on UserReport

---

## Models

### City

```python
class City(models.Model):
    name    = models.CharField(max_length=100)   # "Lagos"
    state   = models.CharField(max_length=100)   # "Lagos State"
    country = models.CharField(max_length=100, default="Nigeria")
    bounds  = gis_models.PolygonField(null=True, blank=True)  # JSON fallback in dev
    is_active = models.BooleanField(default=True)
    created_at / updated_at
```

---

### TransportStop

```python
class TransportStop(models.Model):
    STOP_TYPES = [('bus','Bus Stop'), ('keke','Keke Park'),
                  ('okada','Okada Stand'), ('walk','Walking Point'), ('junction','Junction')]

    name               = models.CharField(max_length=200)
    stop_type          = models.CharField(max_length=20, choices=STOP_TYPES)
    location           = gis_models.PointField(default=dict)  # {"lat":6.52,"lng":3.38} in dev
    address            = models.TextField(blank=True)
    city               = FK(City)
    landmark           = models.CharField(max_length=200, blank=True)
    is_verified        = models.BooleanField(default=False)
    verification_count = models.IntegerField(default=0)
    created_at / updated_at
```

---

### TransportRoute

```python
class TransportRoute(models.Model):
    TRANSPORT_MODES = [('bus','Bus/Danfo'), ('keke','Keke/Tricycle'),
                       ('okada','Okada/Motorbike'), ('walk','Walking')]

    route_number     = models.CharField(max_length=50, blank=True)
    transport_mode   = models.CharField(max_length=20, choices=TRANSPORT_MODES)
    name             = models.CharField(max_length=200)
    origin_stop      = FK(TransportStop, related_name='routes_from')
    destination_stop = FK(TransportStop, related_name='routes_to')
    path             = gis_models.LineStringField(null=True, blank=True)
    city             = FK(City)
    is_active        = models.BooleanField(default=True)
    operating_hours_start / operating_hours_end = TimeField(null)
    frequency_minutes = models.IntegerField(null=True)
    created_at / updated_at
```

---

### RouteSegment

```python
class RouteSegment(models.Model):
    route                    = FK(TransportRoute, related_name='segments')
    stop                     = FK(TransportStop, related_name='segments')
    sequence                 = models.IntegerField()
    estimated_time_minutes   = models.IntegerField(default=0)
    distance_km              = models.FloatField(default=0.0)

    class Meta:
        unique_together = ['route', 'sequence']
        ordering = ['route', 'sequence']
```

---

### Fare

```python
class Fare(models.Model):
    route            = FK(TransportRoute)
    origin_stop      = FK(TransportStop, null=True)
    destination_stop = FK(TransportStop, null=True)
    amount_ngn       = models.DecimalField(max_digits=10, decimal_places=2)
    currency         = models.CharField(max_length=3, default='NGN')
    is_verified      = models.BooleanField(default=False)
    report_count     = models.IntegerField(default=0)
    last_verified    = models.DateTimeField(null=True)
    created_at / updated_at
```

---

### RouteSuggestion

```python
class RouteSuggestion(models.Model):
    origin      = gis_models.PointField(default=dict)
    destination = gis_models.PointField(default=dict)
    city        = FK(City)
    total_time_minutes  = models.IntegerField()
    total_distance_km   = models.FloatField()
    total_fare_ngn      = models.DecimalField(max_digits=10, decimal_places=2)
    path                = gis_models.LineStringField(null=True)
    steps               = models.JSONField(default=list)
    view_count          = models.IntegerField(default=0)
    favorite_count      = models.IntegerField(default=0)
    created_at / updated_at
```

---

### RouteStep

```python
class RouteStep(models.Model):
    suggestion      = FK(RouteSuggestion, related_name='route_steps')
    sequence        = models.IntegerField()
    transport_mode  = models.CharField(max_length=20)
    route           = FK(TransportRoute, null=True)
    instruction     = models.TextField()
    start_location  = gis_models.PointField(default=dict)
    end_location    = gis_models.PointField(default=dict)
    distance_km     = models.FloatField()
    duration_minutes = models.IntegerField()
    fare_ngn        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    intermediate_stops = M2M(TransportStop, blank=True)

    class Meta:
        unique_together = ['suggestion', 'sequence']
```

---

### UserReport

Added in `0003_soft_deletes_and_idempotency`:
- `idempotency_key` — prevents duplicate submissions on network retry
- `deleted_at` — soft delete (NULL = active)

```python
class UserReport(models.Model):
    REPORT_TYPES = [
        ('fare_update','Fare Update'), ('route_disrupted','Route Disrupted'),
        ('new_route','New Route Available'), ('stop_moved','Stop Location Changed'),
        ('route_wrong','Route Information Incorrect'), ('other','Other'),
    ]
    STATUS_CHOICES = [('pending','Pending'), ('verified','Verified'),
                      ('rejected','Rejected'), ('resolved','Resolved')]

    report_type     = models.CharField(max_length=30, choices=REPORT_TYPES)
    route           = FK(TransportRoute, null=True)
    stop            = FK(TransportStop, null=True)
    fare            = FK(Fare, null=True)
    title           = models.CharField(max_length=200)
    description     = models.TextField()
    location        = gis_models.PointField(null=True)
    new_fare_ngn    = models.DecimalField(null=True)
    new_location    = gis_models.PointField(null=True)
    status          = models.CharField(default='pending')
    upvotes / downvotes = models.IntegerField(default=0)
    user_device_id  = models.CharField(max_length=200, blank=True)
    user            = FK(User, null=True)
    idempotency_key = models.CharField(max_length=100, blank=True, db_index=True)  # ← 0003
    created_at / updated_at / verified_at
    deleted_at      = models.DateTimeField(null=True)  # ← 0003 (soft delete)
```

---

### UserFavoritePlace

Added `deleted_at` in `0003`:

```python
class UserFavoritePlace(models.Model):
    user           = FK(User, null=True)
    user_device_id = models.CharField(max_length=200, blank=True)
    name           = models.CharField(max_length=200)
    location       = gis_models.PointField(default=dict)
    address        = models.TextField(blank=True)
    created_at / updated_at
    deleted_at     = models.DateTimeField(null=True)  # ← 0003
```

---

### UserRouteHistory

```python
class UserRouteHistory(models.Model):
    user             = FK(User, null=True)
    user_device_id   = models.CharField(max_length=200, blank=True)
    origin           = gis_models.PointField(default=dict)
    destination      = gis_models.PointField(default=dict)
    origin_name      = models.CharField(max_length=200, blank=True)
    destination_name = models.CharField(max_length=200, blank=True)
    route_suggestion = FK(RouteSuggestion, null=True)
    searched_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-searched_at']
```

---

### Corridor

Added in `0002_corridor_models`:

```python
class Corridor(models.Model):
    corridor_id  = models.CharField(max_length=50, unique=True)  # "C001"
    name         = models.CharField(max_length=250)
    description  = models.TextField(blank=True)
    primary_mode = models.CharField(max_length=20, choices=[
        ('danfo','Danfo/Minibus'), ('brt','BRT'), ('keke','Keke/Tricycle'),
        ('okada','Okada/Motorcycle'), ('ferry','Ferry'),
        ('walk','Walking'), ('mixed','Mixed Modes'),
    ])
    city                  = FK(City, related_name='corridors')
    is_active             = models.BooleanField(default=True)
    operating_hours_start / operating_hours_end = TimeField(null)
    notes                 = models.TextField(blank=True)
    created_at / updated_at
```

---

### CorridorStop

```python
class CorridorStop(models.Model):
    STOP_TYPES = [
        ('major_park','Major Park'), ('major_interchange','Major Interchange'),
        ('bus_stop','Bus Stop'), ('major_bus_stop','Major Bus Stop'),
        ('junction','Junction'), ('major_junction','Major Junction'),
        ('terminal','Terminal'), ('major_terminal','Major Terminal'),
    ]

    corridor   = FK(Corridor, related_name='corridor_stops')
    stop       = FK(TransportStop, related_name='corridor_positions')
    sequence   = models.IntegerField()
    stop_type  = models.CharField(max_length=20, choices=STOP_TYPES)
    estimated_time_from_previous = models.IntegerField(default=0)  # minutes

    class Meta:
        unique_together = ['corridor', 'sequence']
        ordering = ['corridor', 'sequence']
```

---

### StopConnection

```python
class StopConnection(models.Model):
    from_stop      = FK(TransportStop, related_name='connections_from')
    to_stop        = FK(TransportStop, related_name='connections_to')
    transport_mode = models.CharField(max_length=20, choices=[
        ('danfo','Danfo'), ('brt','BRT'), ('keke','Keke'),
        ('okada','Okada'), ('ferry','Ferry'), ('walk','Walking'),
    ])
    corridor               = FK(Corridor, null=True, related_name='connections')
    estimated_time_minutes = models.IntegerField(default=5)
    distance_km            = models.FloatField(default=0.0)
    is_verified            = models.BooleanField(default=False)
    created_at / updated_at

    class Meta:
        unique_together = ['from_stop', 'to_stop', 'transport_mode']
```

---

## Relationships Diagram

```
City
├── TransportStop (many)
├── TransportRoute (many)
├── RouteSuggestion (many)
└── Corridor (many)

TransportStop
├── routes_from / routes_to  → TransportRoute
├── segments                 → RouteSegment
├── fares_from / fares_to    → Fare
├── reports                  → UserReport
├── corridor_positions       → CorridorStop (many corridors per stop)
├── connections_from / to    → StopConnection
└── intermediate_stops       → RouteStep (M2M)

Corridor
├── corridor_stops           → CorridorStop (ordered sequence)
└── connections              → StopConnection

RouteSuggestion
└── route_steps              → RouteStep

User (auth.User)
├── UserReport (many)
├── UserFavoritePlace (many)
└── UserRouteHistory (many)
```

---

## PostGIS Setup (Production)

```python
# settings.py (production)
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'wakaway_db',
        ...
    }
}
```

In development, the PostGIS import is wrapped in a try/except. If GDAL is absent, geometry fields fall back to `JSONField` storing `{"lat": 6.52, "lng": 3.38}`. All migrations work in both modes.

---

## Seeding Corridor Data

```bash
cd server/backend
python manage.py seed_lagos_corridors --file waka_way_corridors.json --city Lagos
```

Seeds 8 corridors (C001–C008), 79 stops, and 40+ inter-stop connections.
