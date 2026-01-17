# WakaWay - Setup & Running Guide

This guide will help you set up and run the WakaWay app on your local machine.

---

## Prerequisites

Before starting, make sure you have installed:

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.10 or higher) - [Download](https://www.python.org/downloads/)
- **PostgreSQL** (v14 or higher) with PostGIS - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)

### Optional (for mobile development)
- **Expo Go** app on your phone (iOS or Android)
- **Android Studio** (for Android emulator)
- **Xcode** (for iOS simulator, macOS only)

---

## Quick Start (Without PostGIS - SQLite)

If you want to start quickly without setting up PostGIS, you can use SQLite first:

### Backend Setup (SQLite)

```bash
# 1. Navigate to backend directory
cd waka-way/server/backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt
pip install django djangorestframework django-cors-headers

# 5. Update settings.py to use SQLite (already configured)
# The settings file has SQLite as fallback, but you need to uncomment it
# Edit backend/settings.py and comment out PostGIS DB, uncomment SQLite DB

# 6. Run migrations
python manage.py makemigrations
python manage.py migrate

# 7. Create superuser (optional, for admin panel)
python manage.py createsuperuser

# 8. Run development server
python manage.py runserver
```

The backend should now be running at `http://localhost:8000`

---

## Full Setup (With PostGIS)

### Step 1: Install PostgreSQL with PostGIS

#### Windows
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. During installation, select "PostGIS" component
3. Note your PostgreSQL password

#### macOS
```bash
brew install postgresql postgis
brew services start postgresql
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib postgis postgresql-14-postgis-3
```

### Step 2: Set Up Database

```bash
# 1. Open PostgreSQL terminal
# Windows: Use pgAdmin or psql from command line
# macOS/Linux: 
psql postgres

# 2. Create database and user
CREATE DATABASE wakaway_db;
CREATE USER wakaway_user WITH PASSWORD 'your_password_here';
ALTER ROLE wakaway_user SET client_encoding TO 'utf8';
ALTER ROLE wakaway_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE wakaway_user SET timezone TO 'Africa/Lagos';
GRANT ALL PRIVILEGES ON DATABASE wakaway_db TO wakaway_user;

# 3. Connect to the new database
\c wakaway_db

# 4. Enable PostGIS extension
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;

# 5. Grant permissions
GRANT ALL ON SCHEMA public TO wakaway_user;

# 6. Exit
\q
```

### Step 3: Backend Setup

```bash
# 1. Navigate to backend directory
cd waka-way/server/backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Update database settings in backend/settings.py
# Update the DATABASES configuration with your credentials:
# NAME: 'wakaway_db'
# USER: 'wakaway_user'
# PASSWORD: 'your_password_here'
# HOST: 'localhost'
# PORT: '5432'

# 6. Run migrations
python manage.py makemigrations
python manage.py migrate

# 7. Create superuser (optional, for admin panel)
python manage.py createsuperuser

# 8. Run development server
python manage.py runserver
```

Backend is now running at `http://localhost:8000`

**Test the API:**
- Admin panel: `http://localhost:8000/admin`
- API root: `http://localhost:8000/api/v1/` (once API views are set up)

---

## Frontend Setup

### Step 1: Install Dependencies

```bash
# 1. Navigate to client directory
cd waka-way/client

# 2. Install npm dependencies
npm install

# If you encounter issues, try:
npm install --legacy-peer-deps
```

### Step 2: Update API Configuration (if needed)

Edit `src/utils/constants.ts` to ensure the API URL matches your backend:

```typescript
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.wakaway.com/api/v1';
```

**For Android Emulator**, use `http://10.0.2.2:8000` instead of `localhost`
**For iOS Simulator**, use `http://localhost:8000`
**For Physical Device**, use your computer's IP address (e.g., `http://192.168.1.100:8000`)

### Step 3: Run the App

```bash
# Make sure you're in the client directory
cd waka-way/client

# Start Expo development server
npx expo start

# Or use npm script
npm start
```

You'll see a QR code and options to:
- Press `a` - Open Android emulator
- Press `i` - Open iOS simulator
- Press `w` - Open in web browser
- Scan QR code - Open in Expo Go app on your phone

---

## Running Both Frontend and Backend

You'll need **two terminal windows**:

### Terminal 1: Backend Server
```bash
cd waka-way/server/backend
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # macOS/Linux

python manage.py runserver
```

### Terminal 2: Frontend (Expo)
```bash
cd waka-way/client
npm start
# or
npx expo start
```

---

## Testing the Setup

### Test Backend
1. Open browser to `http://localhost:8000/admin`
2. Login with superuser credentials
3. You should see the Django admin panel

### Test Frontend
1. Open Expo app on your phone or emulator
2. You should see the app loading
3. The basic App.tsx should display "Open up App.tsx to start working on your app!"

---

## Common Issues & Solutions

### Issue: PostgreSQL Connection Error

**Solution:**
- Make sure PostgreSQL is running
- Check database credentials in `settings.py`
- Verify PostGIS extension is installed: `psql -d wakaway_db -c "SELECT PostGIS_version();"`

### Issue: CORS Errors

**Solution:**
- Make sure `django-cors-headers` is installed
- Check `CORS_ALLOWED_ORIGINS` in `settings.py`
- For physical device, add your computer's IP to allowed origins

### Issue: Expo Cannot Connect to Backend

**Solution:**
- Check your backend is running on port 8000
- For physical device, update API URL to use your computer's IP address
- For Android emulator, use `10.0.2.2:8000` instead of `localhost:8000`
- Check firewall settings

### Issue: Module Not Found Errors

**Solution:**
```bash
# Frontend
cd waka-way/client
rm -rf node_modules package-lock.json
npm install

# Backend
cd waka-way/server/backend
pip install -r requirements.txt
```

### Issue: Port Already in Use

**Solution:**
```bash
# For Django (port 8000)
python manage.py runserver 8001

# For Expo (usually auto-detects new port)
# Or kill the process using the port
```

---

## Next Steps

1. **Set up API endpoints** - Create views and URL routing
2. **Implement Home Screen** - Create the main map view
3. **Add Location Services** - Implement GPS detection
4. **Connect Frontend to Backend** - Set up API client
5. **Import Initial Data** - Add Lagos routes and stops

See [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) for detailed development phases.

---

## Development Tips

### Hot Reload
- **Frontend**: Changes in React Native components auto-reload
- **Backend**: Django auto-reloads on file changes (no need to restart server)

### Debugging
- **Frontend**: Use React Native Debugger or Chrome DevTools
- **Backend**: Use Django debug toolbar or print statements
- **API**: Use Postman or curl to test endpoints

### Database Management
```bash
# View migrations
python manage.py showmigrations

# Create new migration after model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Access Django shell
python manage.py shell
```

---

## Environment Variables (Optional)

For production or advanced setup, use environment variables:

### Backend (.env file in `server/backend/`)
```
SECRET_KEY=your_secret_key_here
DEBUG=True
DATABASE_URL=postgresql://user:password@localhost:5432/wakaway_db
ALLOWED_HOSTS=localhost,127.0.0.1
```

### Frontend (.env file in `client/`)
```
API_BASE_URL=http://localhost:8000/api/v1
GOOGLE_MAPS_API_KEY=your_google_maps_key_here
```

---

## Need Help?

- Check the [README.md](README.md) for overview
- Review [CODE_STRUCTURE.md](CODE_STRUCTURE.md) for architecture
