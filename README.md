# WakaWay - Nigerian Transport Navigation App

**Find your WakaWay** - A mobile app designed to help Nigerians navigate local transport options like buses (danfo), keke (tricycles), okada (motorbikes), and walking.

![WakaWay Logo](https://via.placeholder.com/200x200/2ECC71/FFFFFF?text=W)

---

## 📱 Overview

WakaWay is a location-based navigation app that helps users in Nigerian urban areas find the best routes using local transport modes. The app suggests route combinations, provides step-by-step instructions, estimates fares and travel times, and allows users to contribute route updates.

### Core Features (MVP)

- ✅ **GPS Location Detection**: Automatically detects user's current location
- ✅ **Destination Search**: Search for destinations via address or landmark
- ✅ **Multi-Modal Route Suggestions**: Combines bus, keke, okada, and walking
- ✅ **Step-by-Step Instructions**: Detailed navigation guidance
- ✅ **Fare Estimates**: Shows estimated cost for each route option
- ✅ **Travel Time**: Displays approximate travel duration
- ✅ **Map Visualization**: Visual route display on map
- ✅ **User Reports**: Crowdsourced route and fare updates

---

## 🛠️ Tech Stack

### Frontend
- **React Native** with **Expo** for rapid development
- **TypeScript** for type safety
- **React Navigation** for screen navigation
- **React Native Maps** for map visualization
- **Expo Location** for GPS services

### Backend
- **Django** + **Django REST Framework** for API
- **PostgreSQL** + **PostGIS** for geospatial data
- **Python 3.10+**

### Maps & Location
- **Google Maps SDK** or **OpenStreetMap** via React Native Maps
- **Expo Location** for GPS services
- **OSM Nominatim** or **Google Places** for geocoding

---

## 🏆 The "Backend" Win

Built a **custom multimodal routing engine** that calculates routes with:

| Feature | Description |
|---------|-------------|
| **First-Mile Pivot** | Automatically suggests keke/okada if walking exceeds 1.2km |
| **Danger Zone Avoidance** | Routes around unsafe areas with 300m buffer |
| **Dynamic Pricing** | Peak hours, night rates, and Lagos-specific fares |
| **Multi-Modal Segments** | Intelligently combines walk/keke/okada/danfo/BRT/ferry |
| **Contextual Guides** | Step-by-step instructions with landmark references |

The engine generates Lagos-specific transit routes **without relying on traditional transit APIs** that don't cover informal Nigerian transport (danfo, keke, okada). It uses realistic speed estimates per mode and calculates accurate fare estimates based on current pricing.

---

## 📁 Project Structure

```
waka-way/
├── client/                 # React Native/Expo frontend
│   ├── src/
│   │   ├── screens/        # Screen components
│   │   ├── components/     # Reusable components
│   │   ├── services/       # API & business logic
│   │   ├── utils/          # Utilities & constants
│   │   └── types/          # TypeScript types
│   └── package.json
│
├── server/                 # Django backend
│   └── backend/
│       ├── core/           # Main app
│       │   ├── models.py   # Database models
│       │   ├── serializers.py
│       │   ├── views.py
│       │   └── services/   # Business logic
│       └── backend/        # Project settings
│
└── Documentation/          # Design & planning docs
    ├── DESIGN_DOCUMENTATION.md
    ├── DATABASE_SCHEMA.md
    ├── CODE_STRUCTURE.md
    ├── UX_FLOWS.md
    └── IMPLEMENTATION_ROADMAP.md
```

---

## 📚 Documentation

### Design & Planning
- **[Design Documentation](DESIGN_DOCUMENTATION.md)**: Complete UI/UX design system, wireframes, and mockups
- **[Database Schema](DATABASE_SCHEMA.md)**: Detailed database models and relationships
- **[Code Structure](CODE_STRUCTURE.md)**: Project architecture and component organization
- **[UX Flows](UX_FLOWS.md)**: User experience flows and Nigerian context considerations
- **[Implementation Roadmap](IMPLEMENTATION_ROADMAP.md)**: 12-week development plan

### Quick Links
- [Color Palette](#-brand-colors)
- [Typography](#-typography)
- [API Endpoints](CODE_STRUCTURE.md#api-design)
- [Database Models](DATABASE_SCHEMA.md#database-models)

---

## 🎨 Brand Identity

### Colors

- **Lagos Green**: `#2ECC71` (Primary)
- **Vibrant Purple**: `#6C63FF` (Secondary)
- **Okada Orange**: `#FFA726` (Accent)
- **Soft White**: `#F7F7F7` (Background)
- **Deep Charcoal**: `#222222` (Text)

### Typography

- **Primary**: Poppins (Regular, Medium, Semi-Bold, Bold)
- **Display**: Raleway Bold
- **Alternative**: Nunito Sans

### Taglines

- "Find your WakaWay"
- "Move Smart. Move Local"
- "Your Way. The Naija Way"
- "Waka easy, anywhere you dey."

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.10+
- PostgreSQL 14+ with PostGIS extension
- Expo CLI (`npm install -g expo-cli`)
- Git

### Frontend Setup

```bash
cd client
npm install
npx expo start
```

### Backend Setup

```bash
cd server/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up database
createdb wakaway_db
psql -d wakaway_db -c "CREATE EXTENSION postgis;"

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run server
python manage.py runserver
```

### Environment Variables

Create `.env` files for configuration:

**Frontend** (`client/.env`):
```
API_BASE_URL=http://localhost:8000/api/v1
GOOGLE_MAPS_API_KEY=your_key_here
```

**Backend** (`server/backend/.env`):
```
SECRET_KEY=your_secret_key
DEBUG=True
DATABASE_URL=postgresql://user:password@localhost:5432/wakaway_db
```

---

## 📱 Features in Detail

### 1. Route Search
- Enter destination via search bar
- Select from recent searches or popular destinations
- View multiple route options with time, fare, and distance
- Filter by transport mode (bus, keke, okada, walk)

### 2. Step-by-Step Navigation
- Detailed instructions for each step
- Visual map with route overlay
- Transport mode icons and indicators
- Distance and time per step
- Fare breakdown

### 3. Map Visualization
- User's current location
- Route path with polyline
- Transport stops marked
- Destination marker
- Interactive map controls

### 4. User Reports
- Report incorrect fare information
- Report route disruptions
- Report new routes
- Report stop location changes
- Crowdsourced verification system

### 5. Favorite Places
- Save frequently visited locations
- Quick access from home screen
- Custom naming (Home, Office, etc.)

---

## 🗺️ Supported Cities (MVP)

- **Lagos** (Initial launch)
- **Abuja** (Phase 2)

---

## 🔮 Future Features

### Phase 2
- Real-time navigation with turn-by-turn directions
- Offline mode with cached routes
- User authentication and profiles
- Route history
- Payment integration

### Phase 3
- ML-based route optimization
- Live traffic updates
- Driver/hawker ratings
- Emergency contacts and SOS
- Voice navigation in Nigerian languages

---

## 🤝 Contributing

This is currently a private project. For future contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

[Add your license here]

---

## 👥 Team

[Add team members here]

---

## 📞 Contact

[Add contact information here]

---

## 🙏 Acknowledgments

- Nigerian transport community for route information
- OpenStreetMap for map data
- All beta testers and early users

---

## 📊 Development Status

**Current Phase**: Design & Planning ✅

**Next Steps**: 
1. Set up development environments
2. Begin MVP development (Week 1)
3. Data collection for Lagos routes
4. API development
5. Frontend implementation

See [Implementation Roadmap](IMPLEMENTATION_ROADMAP.md) for detailed timeline.

---

**Find your WakaWay!** 🚀

