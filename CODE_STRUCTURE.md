# WakaWay - Code Structure & Architecture

## Table of Contents
1. [Frontend Structure (React Native/Expo)](#frontend-structure)
2. [Backend Structure (Django)](#backend-structure)
3. [API Design](#api-design)
4. [Component Library](#component-library)

---

## Frontend Structure (React Native/Expo)

### Project Directory Structure

```
waka-way/client/
├── App.tsx                    # Main app entry point
├── app.json                   # Expo configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
│
├── assets/                    # Static assets
│   ├── images/
│   │   ├── logo.png
│   │   ├── transport-icons/
│   │   │   ├── bus.png
│   │   │   ├── keke.png
│   │   │   ├── okada.png
│   │   │   └── walk.png
│   ├── fonts/
│   │   ├── Poppins-Regular.ttf
│   │   ├── Poppins-Bold.ttf
│   │   ├── Nunito-Regular.ttf
│   │   └── Raleway-Bold.ttf
│
├── src/
│   ├── App.tsx                # Root component with navigation
│   │
│   ├── navigation/            # Navigation setup
│   │   ├── AppNavigator.tsx
│   │   └── navigationTypes.ts
│   │
│   ├── screens/               # Screen components
│   │   ├── HomeScreen.tsx     # Main map/search screen
│   │   ├── SearchScreen.tsx   # Destination search
│   │   ├── RouteDetailsScreen.tsx  # Route step-by-step
│   │   ├── RouteResultsScreen.tsx  # Multiple route options
│   │   ├── ReportScreen.tsx   # Report route/fare
│   │   ├── ProfileScreen.tsx  # User profile/settings
│   │   └── SavedPlacesScreen.tsx
│   │
│   ├── components/            # Reusable components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorMessage.tsx
│   │   │
│   │   ├── transport/
│   │   │   ├── TransportIcon.tsx
│   │   │   ├── TransportModeBadge.tsx
│   │   │   └── TransportFilter.tsx
│   │   │
│   │   ├── route/
│   │   │   ├── RouteCard.tsx
│   │   │   ├── RouteStepCard.tsx
│   │   │   ├── FareBreakdown.tsx
│   │   │   ├── RouteMapView.tsx
│   │   │   └── RouteSummary.tsx
│   │   │
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── MapMarker.tsx
│   │   │   └── RoutePolyline.tsx
│   │   │
│   │   └── search/
│   │       ├── SearchBar.tsx
│   │       ├── SearchResults.tsx
│   │       └── LocationCard.tsx
│   │
│   ├── services/              # Business logic & API calls
│   │   ├── api.ts             # API client setup
│   │   ├── locationService.ts # GPS & location services
│   │   ├── routeService.ts    # Route calculation logic
│   │   ├── mapService.ts      # Map utilities
│   │   └── storageService.ts  # AsyncStorage for favorites
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useLocation.ts
│   │   ├── useRoutes.ts
│   │   ├── useSearch.ts
│   │   └── useDebounce.ts
│   │
│   ├── contexts/              # React Context providers
│   │   ├── LocationContext.tsx
│   │   ├── RouteContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── utils/                 # Utility functions
│   │   ├── constants.ts       # App constants
│   │   ├── colors.ts          # Color palette
│   │   ├── typography.ts      # Typography styles
│   │   ├── formatters.ts      # Format time, fare, distance
│   │   ├── validators.ts      # Input validation
│   │   └── helpers.ts         # General helpers
│   │
│   └── types/                 # TypeScript type definitions
│       ├── route.types.ts
│       ├── location.types.ts
│       ├── transport.types.ts
│       └── api.types.ts
│
└── __tests__/                 # Tests
    ├── components/
    ├── screens/
    └── services/
```

---

## Backend Structure (Django)

### Project Directory Structure

```
waka-way/server/backend/
├── manage.py
├── requirements.txt
│
├── backend/                   # Main project settings
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py                # Root URL configuration
│   ├── wsgi.py
│   ├── asgi.py
│   └── local_settings.py      # Local dev settings (gitignored)
│
├── core/                      # Main app
│   ├── __init__.py
│   ├── models.py              # Database models
│   ├── admin.py               # Django admin configuration
│   ├── serializers.py         # DRF serializers
│   ├── views.py               # API views
│   ├── viewsets.py            # ViewSets for complex endpoints
│   ├── permissions.py         # Custom permissions
│   ├── filters.py             # Filter backends
│   ├── pagination.py          # Pagination classes
│   │
│   ├── management/
│   │   └── commands/
│   │       ├── import_lagos_routes.py
│   │       └── import_abuja_routes.py
│   │
│   ├── migrations/            # Database migrations
│   │
│   ├── services/              # Business logic
│   │   ├── route_calculator.py
│   │   ├── geocoding_service.py
│   │   ├── fare_calculator.py
│   │   └── report_processor.py
│   │
│   └── utils/
│       ├── exceptions.py      # Custom exceptions
│       ├── validators.py      # Input validators
│       └── helpers.py         # Helper functions
│
├── api/                       # API app (optional separation)
│   ├── __init__.py
│   ├── urls.py                # API URL routing
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── urls.py            # Version 1 API routes
│   │   ├── views.py
│   │   └── serializers.py
│
└── tests/                     # Test suite
    ├── __init__.py
    ├── test_models.py
    ├── test_views.py
    ├── test_services.py
    └── fixtures/
```

---

## API Design

### Base URL
```
Development: http://localhost:8000/api/v1/
Production: https://api.wakaway.com/api/v1/
```

### Authentication
- **Anonymous Users**: Device ID-based (no authentication required for MVP)
- **Authenticated Users** (Future): JWT tokens or API keys

### Endpoints

#### 1. Location Endpoints

```
GET    /api/v1/cities/                    # List all cities
GET    /api/v1/cities/{id}/               # Get city details
GET    /api/v1/stops/                     # List transport stops
GET    /api/v1/stops/nearby/              # Find nearby stops (lat, lng, radius)
GET    /api/v1/stops/{id}/                # Get stop details
```

#### 2. Route Endpoints

```
GET    /api/v1/routes/                    # List routes
GET    /api/v1/routes/{id}/               # Get route details
POST   /api/v1/routes/search/             # Search routes (origin, destination)
GET    /api/v1/routes/{id}/segments/      # Get route segments
```

#### 3. Route Suggestions

```
POST   /api/v1/suggestions/               # Get route suggestions
GET    /api/v1/suggestions/{id}/          # Get suggestion details
GET    /api/v1/suggestions/{id}/steps/    # Get route steps
```

#### 4. Fares

```
GET    /api/v1/fares/                     # List fares
GET    /api/v1/fares/route/{route_id}/    # Get fares for route
GET    /api/v1/fares/estimate/            # Estimate fare (origin, destination)
```

#### 5. User Reports

```
GET    /api/v1/reports/                   # List reports
POST   /api/v1/reports/                   # Create new report
GET    /api/v1/reports/{id}/              # Get report details
POST   /api/v1/reports/{id}/vote/         # Upvote/downvote report
```

#### 6. User Data

```
GET    /api/v1/favorites/                 # Get user's favorite places
POST   /api/v1/favorites/                 # Add favorite place
DELETE /api/v1/favorites/{id}/            # Remove favorite
GET    /api/v1/history/                   # Get route search history
```

### API Request/Response Examples

#### Search Routes

**Request:**
```http
POST /api/v1/routes/search/
Content-Type: application/json

{
  "origin": {
    "latitude": 6.5244,
    "longitude": 3.3792
  },
  "destination": {
    "latitude": 6.4531,
    "longitude": 3.3947
  },
  "city": 1,
  "transport_modes": ["bus", "keke", "okada"],
  "max_walk_distance_km": 1.0
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": 123,
      "total_time_minutes": 45,
      "total_distance_km": 12.5,
      "total_fare_ngn": "250.00",
      "transport_modes": ["bus", "keke", "walk"],
      "steps": [
        {
          "sequence": 1,
          "transport_mode": "walk",
          "instruction": "Walk to Ikeja Bus Stop",
          "distance_km": 0.5,
          "duration_minutes": 5,
          "fare_ngn": "0.00"
        },
        {
          "sequence": 2,
          "transport_mode": "bus",
          "route_id": 47,
          "route_number": "47",
          "instruction": "Take Bus #47 to Oshodi",
          "distance_km": 8.0,
          "duration_minutes": 25,
          "fare_ngn": "100.00"
        },
        {
          "sequence": 3,
          "transport_mode": "keke",
          "instruction": "Take Keke to destination",
          "distance_km": 3.0,
          "duration_minutes": 10,
          "fare_ngn": "100.00"
        },
        {
          "sequence": 4,
          "transport_mode": "walk",
          "instruction": "Walk to destination",
          "distance_km": 1.0,
          "duration_minutes": 5,
          "fare_ngn": "0.00"
        }
      ],
      "path": {
        "type": "LineString",
        "coordinates": [[3.3792, 6.5244], [3.3947, 6.4531]]
      }
    }
  ]
}
```

#### Create Report

**Request:**
```http
POST /api/v1/reports/
Content-Type: application/json

{
  "report_type": "fare_update",
  "route_id": 47,
  "title": "Bus fare increased",
  "description": "Fare for Bus #47 is now ₦150 instead of ₦100",
  "new_fare_ngn": "150.00",
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  },
  "device_id": "abc123xyz"
}
```

**Response:**
```json
{
  "id": 456,
  "report_type": "fare_update",
  "status": "pending",
  "message": "Report submitted successfully. Thank you!"
}
```

---

## Component Library

### Common Components

#### Button.tsx
```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../utils';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
}) => {
  // Implementation
};
```

#### Input.tsx
```typescript
import React from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';

interface InputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  icon,
}) => {
  // Implementation
};
```

### Route Components

#### RouteCard.tsx
```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TransportIcon } from '../transport';
import { formatTime, formatFare } from '../utils';

interface RouteCardProps {
  suggestion: RouteSuggestion;
  onPress: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({ suggestion, onPress }) => {
  // Implementation
};
```

---

## Key Implementation Files

### Frontend: src/utils/constants.ts
```typescript
export const TRANSPORT_MODES = {
  BUS: 'bus',
  KEKE: 'keke',
  OKADA: 'okada',
  WALK: 'walk',
} as const;

export const COLORS = {
  PRIMARY: '#2ECC71',      // Lagos Green
  SECONDARY: '#6C63FF',    // Vibrant Purple
  ACCENT: '#FFA726',       // Okada Orange
  BACKGROUND: '#F7F7F7',   // Soft White
  TEXT: '#222222',         // Deep Charcoal
} as const;

export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.wakaway.com/api/v1';
```

### Backend: core/serializers.py
```python
from rest_framework import serializers
from .models import RouteSuggestion, RouteStep, TransportRoute

class RouteStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteStep
        fields = [
            'sequence', 'transport_mode', 'instruction',
            'distance_km', 'duration_minutes', 'fare_ngn',
            'start_location', 'end_location'
        ]

class RouteSuggestionSerializer(serializers.ModelSerializer):
    steps = RouteStepSerializer(many=True, read_only=True)
    
    class Meta:
        model = RouteSuggestion
        fields = [
            'id', 'total_time_minutes', 'total_distance_km',
            'total_fare_ngn', 'transport_modes', 'steps', 'path'
        ]
```

---

## Next Steps

1. Set up project structure following this architecture
2. Implement core models and serializers
3. Create basic React Native components
4. Implement API endpoints
5. Build route calculation service
6. Integrate maps and location services
7. Add user reporting functionality
8. Test end-to-end flow

