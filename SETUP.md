# 🛠️ Setup Guide - AI Resume Builder

> **First-time setup only** - Follow these steps to get everything running on your machine.

## 📋 Prerequisites

### 1. Install Node.js 18.x LTS (Required Version)

```bash
# First, uninstall any existing Node.js versions
# For macOS/Linux:
brew uninstall node --force  # If installed via Homebrew
sudo apt-get remove nodejs npm  # If installed via apt
nvm uninstall --lts  # If installed via nvm

# Install nvm (recommended for macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc  # Reload shell

# Install Node.js 18.x LTS (Hydrogen)
nvm install --lts=hydrogen
nvm use --lts=hydrogen

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or later
```

### 2. Install MongoDB 6.0+

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community
```

**Windows:**
1. **Uninstall existing Node.js:**
   - Go to Control Panel > Programs > Uninstall a program
   - Find and uninstall Node.js
   - Delete these folders if they exist:
     - `C:\Program Files\nodejs`
     - `C:\Users\[Username]\AppData\Roaming\npm`
     - `C:\Users\[Username]\AppData\Roaming\nvm`

2. **Install Node.js 18.x LTS:**
   - Download from [Node.js Official Site](https://nodejs.org/en/download/)
   - Select the Windows Installer for **18.x LTS**
   - Run the installer with default settings

3. **Install MongoDB:**
   - Download from [MongoDB Community Server](https://www.mongodb.com/try/download/community)
   - Run the installer
   - Add MongoDB to your system PATH

**Linux (Ubuntu/Debian):**
```bash
# Import the public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -sc)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Reload local package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 3. Install Git (Optional but Recommended)

```bash
# macOS
brew install git

# Linux (Debian/Ubuntu)
sudo apt install git

# Windows: Download from https://git-scm.com/download/win
```

## 🚀 Project Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd resume-builder
   ```

2. **Set up environment variables**
   ```bash
   # Copy example files
   cp .env.example .env
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

3. **Edit the environment files**
   - Update `server/.env` with your MongoDB connection string and other settings
   - Set `GOOGLE_AI_API_KEY` if you want to use AI features

4. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   cd ..
   ```

5. **Initialize MongoDB**
   ```bash
   # Create data directory (first time only)
   mkdir -p ~/mongodb-data/db
   
   # Start MongoDB (in a new terminal)
   mongod --dbpath ~/mongodb-data/db
   ```

6. **Start the application**
   ```bash
   # In the project root directory
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 🔧 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongod --version

# Start MongoDB service
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS
net start MongoDB  # Windows (run as Administrator)
```

### Node.js Version Issues
```bash
# Check Node.js version
node --version

# If incorrect version, use nvm to switch
nvm install 18
nvm use 18
```

### Missing Dependencies
```bash
# In both client and server directories
rm -rf node_modules package-lock.json
npm install
```

## 📦 Production Deployment

1. **Build the React app**
   ```bash
   cd client
   npm run build
   ```

2. **Start production server**
   ```bash
   cd ../server
   NODE_ENV=production npm start
   ```

## 📚 Next Steps

- [ ] Set up a process manager like PM2 for production
- [ ] Configure a reverse proxy (Nginx/Apache)
- [ ] Set up SSL certificates (Let's Encrypt)

## 📞 Need Help?

If you encounter any issues during setup, please:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Search the [GitHub Issues](https://github.com/yourusername/resume-builder/issues)
3. Open a new issue if your problem isn't listed

---
*Last updated: December 2025*

1. **Start MongoDB** (in a new terminal):
   ```bash
   # Create data directory (first time only)
   mkdir -p ~/mongodb-data/db
   
   # Start MongoDB
   mongod --dbpath ~/mongodb-data/db
   ```

2. **Start the Backend Server** (in a new terminal):
   ```bash
   # Kill any process using port 5000 (if needed)
   lsof -ti:5000 | xargs kill -9 2>/dev/null || true
   
   cd /Users/deepaksingh/Desktop/Resume\ builder/server
   npm install
   npm run dev
   ```

3. **Start the Frontend** (in a new terminal):
   ```bash
   cd /Users/deepaksingh/Desktop/Resume\ builder/client
   npm install
   npm start
   ```

4. **Access the Application**:
   - Open http://localhost:3000 in your browser
   - Register a new account and start building your resume!

---

## 📝 Detailed Setup Guide

This guide provides detailed instructions for setting up the AI-Powered Resume Builder on your local machine.

## Prerequisites

1. **Node.js** (v16 or higher)
   - Download from: https://nodejs.org/
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **MongoDB** (v4.4 or higher)
   - Community Server: https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud version)
   - Verify installation:
     ```bash
     mongod --version
     ```

3. **Git** (for version control)
   - Download from: https://git-scm.com/
   - Verify installation:
     ```bash
     git --version
     ```

## Project Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Resume-builder
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

## Environment Configuration

1. **Server Environment Variables**
   Create a `.env` file in the `server` directory:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/ai-resume-builder
   JWT_SECRET=your_secure_jwt_secret
   GOOGLE_AI_API_KEY=your_google_ai_api_key
   ```

2. **Client Environment Variables**
   Create a `.env` file in the `client` directory:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   ```

## Database Setup

1. **Local MongoDB**
   - Make sure MongoDB is running locally
   - The server will automatically create the database on first run

2. **MongoDB Atlas (Cloud)**
   - Create a free cluster at https://cloud.mongodb.com
   - Get the connection string and update `MONGODB_URI` in `.env`
   - Example:
     ```
     MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/ai-resume-builder?retryWrites=true&w=majority
     ```

## Available Scripts

### Server (from `/server` directory)
- `npm start` - Start the production server
- `npm run dev` - Start the development server with nodemon
- `npm test` - Run tests

### Client (from `/client` directory)
- `npm start` - Start the React development server
- `npm run build` - Build for production
- `npm test` - Run tests

## Running the Application

1. **Start the server** (in a new terminal)
   ```bash
   cd server
   npm run dev
   ```

2. **Start the client** (in a new terminal)
   ```bash
   cd client
   npm start
   ```

3. **Access the application**
   - Open your browser and go to: http://localhost:3000

## Production Deployment

### 1. Build the React app
```bash
cd client
npm run build
```

### 2. Set production environment variables
In `server/.env`:
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your_production_mongodb_uri
JWT_SECRET=your_secure_jwt_secret
GOOGLE_AI_API_KEY=your_google_ai_api_key
```

### 3. Start the production server
```bash
cd server
npm install --production
npm start
```

## Troubleshooting

1. **Port already in use**
   - Change the port in `.env` or stop the process using the port
   ```bash
   # On Linux/Mac
   lsof -i :5000
   kill -9 <PID>
   ```

2. **MongoDB connection issues**
   - Make sure MongoDB is running
   - Check your connection string in `.env`
   - For local MongoDB, try: `sudo service mongod start`

3. **Missing dependencies**
   ```bash
   # In both client and server directories
   rm -rf node_modules package-lock.json
   npm install
   ```

## Environment Variables Reference

### Server
- `PORT` - Port for the Express server (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT token generation
- `GOOGLE_AI_API_KEY` - Your Google AI API key
- `NODE_ENV` - Environment (development/production)

### Client
- `REACT_APP_API_URL` - Base URL for API requests

## License

[Your License Here]

---

For support, please contact [your-email@example.com]
