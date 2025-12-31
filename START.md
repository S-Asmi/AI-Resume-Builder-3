# 🚀 Quick Start Guide

> **Daily usage instructions** - Follow these steps each time you want to work on the project.

## 🏃‍♂️ Start Development

1. **Start MongoDB** (in a new terminal)
   ```bash
   # Create data directory if it doesn't exist
   mkdir -p ~/mongodb-data/db
   
   # Start MongoDB
   mongod --dbpath ~/mongodb-data/db
   ```

2. **Start the backend server** (in a new terminal)
   ```bash
   cd server
   npm run dev
   ```

3. **Start the frontend** (in a new terminal)
   ```bash
   cd client
   npm start
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 🛑 Stopping the Application

1. **Stop the frontend**
   - Press `Ctrl+C` in the frontend terminal

2. **Stop the backend**
   - Press `Ctrl+C` in the backend terminal

3. **Stop MongoDB** (if needed)
   - Press `Ctrl+C` in the MongoDB terminal
   - Or run: `pkill -f mongod`

## 🔄 Common Workflows

### Reset Everything
```bash
# Stop all running services
pkill -f "node|npm|mongod"

# Start fresh
mongod --dbpath ~/mongodb-data/db &
cd server && npm run dev &
cd ../client && npm start
```

### Clear Database
```bash
# Connect to MongoDB
mongo

# Switch to the database
use resume-builder

# Clear all collections
db.getCollectionNames().forEach(c => db[c].drop())
```

## 🚨 Common Issues

### Port Already in Use
```bash
# Find and kill processes
lsof -ti:3000 | xargs kill -9 2>/dev/null  # Frontend
lsof -ti:5000 | xargs kill -9 2>/dev/null  # Backend
```

### Frontend Not Connecting to Backend
1. Make sure the backend server is running
2. Check `client/.env` has the correct API URL:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   ```
3. Clear browser cache or try incognito mode

### MongoDB Not Starting
```bash
# Check if MongoDB is already running
ps aux | grep mongo

# Kill existing instance
pkill -f mongod

# Start fresh
mongod --dbpath ~/mongodb-data/db
```

## 📝 Notes
- All data is stored in `~/mongodb-data/db` by default
- You can change the database path by modifying the `--dbpath` parameter
- For production, use `npm start` in the server directory after building the React app

---
*Last updated: November 2025*
   ```bash
   # Copy example environment files
   cp .env.example .env
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```
   - Edit `.env` files with your configuration

4. **Start MongoDB** (in a new terminal)
   ```bash
   # Create data directory (first time only)
   mkdir -p ~/mongodb-data/db
   
   # Start MongoDB
   mongod --dbpath ~/mongodb-data/db
   ```

5. **Launch the application**
   ```bash
   # Start both frontend and backend
   npm run dev
   ```

6. **Open in browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client and server with hot-reload |
| `npm run server` | Start only the backend server |
| `npm run client` | Start only the frontend development server |
| `npm run build` | Build the React app for production |
| `npm start` | Start the production server |
| `npm run install-all` | Install all dependencies (root, client, and server) |

## 🐛 Common Issues

### Port Conflicts
```bash
# Find and kill processes
lsof -ti:3000 | xargs kill -9 2>/dev/null  # Frontend
lsof -ti:5000 | xargs kill -9 2>/dev/null  # Backend
```

### Dependency Issues
```bash
# In both client and server directories
rm -rf node_modules package-lock.json
npm install
```

### MongoDB Not Starting
```bash
# For macOS (using Homebrew)
brew services start mongodb-community
1. Make sure MongoDB is running (check Terminal 1)
2. Restart the backend server (Terminal 2)

### Login/Register not working
1. Check all 3 terminals for error messages
2. Make sure MongoDB is connected (look for ✅ in Terminal 2)
3. Clear browser cache and try again


If you ever face the "port 5000 is already in use" error again, you can either:

Kill the process using that port with:
 lsof -ti :5000 | xargs kill -9
Or use separate terminals:
Terminal 1: cd server && npm run dev
Terminal 2: cd client && npm start