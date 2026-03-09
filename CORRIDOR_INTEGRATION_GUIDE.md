# Lagos Transport Corridor Integration Guide

## Overview

Implementation of the Lagos transport network corridors into the Waka Way application. This integration adds support for 8 major transport corridors with detailed stop information and inter-stop connections.

## What Was Implemented

### 1. Database Models

#### **Corridor Model**
- Stores corridor metadata (ID, name, primary mode, operational details)
- Supports 7 transport modes: Danfo, BRT, Keke, Okada, Ferry, Walk, Mixed
- Linked to City model for spatial organization

#### **CorridorStop Model**  
- Junction table linking corridors to transport stops in sequence
- Stores stop type (major park, interchange, junction, terminal, etc.)
- Includes estimated time from previous stop for journey planning
- Maintains sequence ordering for corridor navigation

#### **StopConnection Model**
- Represents alternative transport connections between stops
- From any stop within one corridor, you can take different transport modes to other stops
- Stores estimated time and distance for each connection
- Verification flag for crowdsourced validation

### 2. API Endpoints

#### Corridors
```
GET    /api/v1/corridors/              - List all corridors (paginated)
GET    /api/v1/corridors/{id}/         - Retrieve corridor with all stops & connections
```

Query parameters for filtering:
- `city` - Filter by city ID
- `primary_mode` - Filter by transport mode (danfo, brt, keke, okada, ferry, walk, mixed)
- `is_active` - Filter active/inactive corridors
- `search` - Search by name or corridor ID
- `page` - Pagination page number
- `page_size` - Results per page (max 100)
- `ordering` - Sort by: name, created_at, corridor_id

#### Corridor Stops
```
GET    /api/v1/corridor-stops/         - List all corridor stops
```

Query parameters:
- `corridor` - Filter by corridor ID (required for practical use)
- `page`, `page_size`, `ordering`

#### Stop Connections
```
GET    /api/v1/stop-connections/       - List all stop connections
```

Query parameters:
- `from_stop` - Filter by origin stop
- `to_stop` - Filter by destination stop
- `transport_mode` - Filter by transport mode
- `corridor` - Filter by corridor

### 3. Client-Side

#### TypeScript Types
Located in `client/src/types/corridor.ts`:
- `CorridorMode` - Transport mode type
- `StopType` - Classification of stops
- `CorridorStop` - Stop within corridor structure
- `StopConnection` - Inter-stop connection
- `CorridorList` - Corridor listing
- `CorridorDetail` - Full corridor with stops and connections

#### API Service Methods
Located in `client/src/services/api.ts`:
```typescript
// Get paginated list of corridors
getCorridors(params?: CorridorQueryParams)

// Get full corridor details with stops & connections
getCorridorDetail(id: number)

// Get corridor by ID or code
getCorridorByIdOrCode(idOrCode: string)

// Get stops within a corridor
getCorridorStops(corridorId: number, params?)

// Get connections between stops
getStopConnections(params?: StopConnectionQueryParams)
```

### 4. Management Command

Created `core/management/commands/seed_lagos_corridors.py` for data seeding.

## How to Integrate

### Step 1: Run Database Migrations

```bash
cd server/backend
python manage.py migrate
```

This will:
- Create `Corridor` table
- Create `CorridorStop` table with indexes
- Create `StopConnection` table with unique constraints
- Create necessary foreign key relationships

### Step 2: Seed the Data

```bash
cd server/backend
python manage.py seed_lagos_corridors --file waka_way_corridors.json --city Lagos
```

The command will:
- Create 8 corridors (C001-C008)
- Create transport stops for each corridor (if not already existing)
- Link stops to corridors in sequence
- Create inter-stop connections based on the "connections" field in JSON

Expected output:
```
Using existing city: Lagos
Processing 8 corridors...

Created corridor: C001 - Ikorodu - Mile 12 Local
  └─ Stop 1: Ikorodu Garage (major_park)
  └─ Stop 2: Agric (bus_stop)
  ...
```

### Step 3: Verify API Endpoints

Test endpoints using curl or API client:

```bash
# Get all corridors
curl http://localhost:8000/api/v1/corridors/

# Get specific corridor with stops & connections
curl http://localhost:8000/api/v1/corridors/1/

# Filter by transport mode
curl http://localhost:8000/api/v1/corridors/?primary_mode=brt

# Search by name
curl http://localhost:8000/api/v1/corridors/?search=Ikorodu
```

## Data Structure

### JSON Format for Corridors

```json
{
  "id": "C001",
  "name": "Ikorodu - Mile 12 Local",
  "primary_mode": "Danfo",
  "stops": [
    {
      "name": "Ikorodu Garage",
      "type": "Major Park",
      "connections": ["Keke to Sabo", "Okada to Ibeshe"]
    },
    ...
  ],
  "notes": "Optional implementation notes"
}
```

### Stop Types

- `major_park` - Main transportation hub/park
- `major_interchange` - Major interchange between routes/modes
- `bus_stop` - Regular bus stop
- `major_bus_stop` - Significant bus stop with multiple routes
- `junction` - Road junction
- `major_junction` - Major junction with multiple connections
- `terminal` - Terminal station
- `major_terminal` - Major terminal like Oshodi or Mile 12

### Connection Format

Connections are formatted as: `"{MODE} to {DESTINATION}"`
- Mode: keke, okada, danfo, ferry, bus, brt
- Destination: Name of the connected stop/area

Example: `"Keke to Sabo"` means "Take a Keke to Sabo"

## Database Schema Relationships

```
City
├── Corridor (primary_mode)
│   ├── CorridorStop (corridor_id, stop_id, sequence)
│   │   └── TransportStop
│   └── StopConnection (corridor_id, from_stop_id, to_stop_id)
│       ├── TransportStop (from_stop)
│       └── TransportStop (to_stop)
└── TransportStop
    ├── CorridorStop (multiple corridors per stop)
    └── StopConnection (as from or to)
```

## Integration with Routing Engine

The corridor data integrates with the routing engine through:

1. **Stop Discovery**: Corridors provide an additional way to discover stops
2. **Route Suggestions**: Use corridor stops to generate route alternatives
3. **Connection Avenues**: StopConnections provide secondary routing options
4. **Transport Mode Filtering**: Use corridor's primary_mode to suggest appropriate vehicles

## API Response Examples

### Get Corridor List
```json
{
  "count": 8,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "corridor_id": "C001",
      "name": "Ikorodu - Mile 12 Local",
      "primary_mode": "danfo",
      "primary_mode_display": "Danfo/Minibus",
      "city": 1,
      "is_active": true,
      "stop_count": 10,
      "notes": "Majidun split into..."
    }
  ]
}
```

### Get Corridor Detail
```json
{
  "id": 1,
  "corridor_id": "C001",
  "name": "Ikorodu - Mile 12 Local",
  "description": "",
  "primary_mode": "danfo",
  "primary_mode_display": "Danfo/Minibus",
  "city": {
    "id": 1,
    "name": "Lagos",
    "state": "Lagos State",
    "country": "Nigeria",
    "is_active": true
  },
  "is_active": true,
  "operating_hours_start": null,
  "operating_hours_end": null,
  "notes": "...",
  "corridor_stops": [
    {
      "id": 1,
      "sequence": 1,
      "stop": {
        "id": 1,
        "name": "Ikorodu Garage",
        "stop_type": "bus",
        "location": null,
        "address": "",
        "city": 1,
        "landmark": "",
        "is_verified": false
      },
      "stop_type": "major_park",
      "stop_type_display": "Major Park",
      "estimated_time_from_previous": 0
    }
  ],
  "connections": [
    {
      "id": 1,
      "from_stop": {...},
      "to_stop": {...},
      "transport_mode": "keke",
      "transport_mode_display": "Keke/Tricycle",
      "corridor": 1,
      "estimated_time_minutes": 10,
      "distance_km": 0.0,
      "is_verified": true,
      "created_at": "2026-03-04T..."
    }
  ],
  "created_at": "2026-03-04T...",
  "updated_at": "2026-03-04T..."
}
```

## Frontend Integration Examples

### Display List of Corridors
```typescript
import { getCorridors } from '@/services/api';
import type { CorridorList } from '@/types/corridor';

async function loadCorridors() {
  const response = await getCorridors({
    city: 1, // Lagos
    page_size: 20
  });
  
  const corridors: CorridorList[] = response.results;
  // Render corridors...
}
```

### Show Corridor Details with Stops
```typescript
import { getCorridorDetail } from '@/services/api';
import type { CorridorDetail } from '@/types/corridor';

async function showCorridorMap(corridorId: number) {
  const corridor: CorridorDetail = await getCorridorDetail(corridorId);
  
  // Display corridor name and mode
  console.log(`${corridor.name} (${corridor.primary_mode_display})`);
  
  // Display all stops in sequence
  corridor.corridor_stops.forEach(cs => {
    console.log(`Stop ${cs.sequence}: ${cs.stop.name} (${cs.stop_type_display})`);
  });
  
  // Display available connections
  corridor.connections.forEach(conn => {
    console.log(`From ${conn.from_stop.name} → ${conn.to_stop.name} by ${conn.transport_mode_display}`);
  });
}
```

### Search Corridors
```typescript
async function searchCorridors(query: string) {
  const response = await getCorridors({
    search: query,  // Search by name or corridor ID
    page_size: 10
  });
  
  return response.results;
}
```

## Files Modified/Created

### Backend
- `server/backend/core/models.py` - Added Corridor, CorridorStop, StopConnection models
- `server/backend/core/migrations/0002_corridor_models.py` - Database migration
- `server/backend/core/serializers.py` - Added corridor serializers
- `server/backend/core/views.py` - Added corridor viewsets
- `server/backend/core/urls.py` - Created with router configuration
- `server/backend/core/management/commands/seed_lagos_corridors.py` - Data seeding command
- `server/backend/backend/urls.py` - Updated to include core URLs
- `server/backend/waka_way_corridors.json` - Corridor data seed file

### Frontend
- `client/src/types/corridor.ts` - Corridor type definitions
- `client/src/types/index.ts` - Updated to export corridor types
- `client/src/services/api.ts` - Added corridor API methods

## Troubleshooting

### Migration Errors
If migrations fail:
```bash
# Reset migrations (careful in development only!)
python manage.py migrate core zero
python manage.py migrate
```

### Seeding Errors
Check that:
1. JSON file is valid: `python -m json.tool waka_way_corridors.json`
2. City "Lagos" exists or is created by the command
3. Database is migrated: `python manage.py showmigrations core`

### API Not Responding
- Check that `djangorestframework` is installed: `pip list | grep djangorestframework`
- Check URL configuration in `backend/urls.py`
- Verify views.py imports are correct

## Future Enhancements

1. **Real-time Updates**: Send WebSocket notifications when corridors change
2. **User Contributions**: Allow users to update fare/time info for corridors
3. **Corridor Analytics**: Track usage patterns, peak hours, crowding
4. **Visual Maps**: Display corridors on interactive maps
5. **Multi-modal Optimization**: Suggest corridor combinations for multi-modal journeys
6. **Corridor Alerts**: Notify users of disruptions or changes on their preferred corridors

## Testing the Integration

```bash
# Run tests for corridor models
python manage.py test core.tests.CorridorTests

# Check API with Django REST framework browsable API
# Navigate to http://localhost:8000/api/v1/corridors/ in browser
```

## Support & Documentation

For questions about:
- **Database schema**: See DATABASE_SCHEMA.md
- **API endpoints**: Use the browsable API at `/api/v1/`
- **Frontend types**: Check TypeScript definitions in `client/src/types/`
