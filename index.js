const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resume');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Trust proxy (required when X-Forwarded-For header is set, e.g., dev proxies)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Resume Builder API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Connect to MongoDB
const startServer = async () => {
  try {
    console.log('🔍 Attempting to connect to MongoDB...');
    
    // Create data directory if it doesn't exist
    const { execSync } = require('child_process');
    try {
      execSync('mkdir -p /data/db');
      execSync('chown -R `id -un` /data/db');
    } catch (e) {
      console.log('⚠️  Could not create /data/db, trying alternative location...');
    }
    
    // Try to start MongoDB if not running
    try {
      const isRunning = require('is-running')(
        parseInt(execSync('pgrep mongod || echo 0').toString())
      );
      
      if (!isRunning) {
        console.log('🔄 Starting MongoDB...');
        try {
          execSync('mongod --dbpath /data/db --fork --logpath /tmp/mongod.log');
          console.log('✅ Started MongoDB in the background');
        } catch (startError) {
          console.log('⚠️  Could not start MongoDB automatically');
          console.log('   Please start MongoDB manually with:');
          console.log('   mongod --dbpath /data/db');
          process.exit(1);
        }
      }
    } catch (e) {
      console.log('⚠️  Could not check if MongoDB is running');
    }
    
    // Connect to MongoDB with retry logic
    const maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ai-resume-builder');
        console.log('✅ Successfully connected to MongoDB');
        break;
      } catch (err) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error('❌ Failed to connect to MongoDB after multiple attempts');
          console.log('💡 Please ensure MongoDB is installed and running');
          console.log('   You can install it with: brew install mongodb-community');
          console.log('   Then start it with: mongod --dbpath /data/db');
          process.exit(1);
        }
        console.log(`⏳ Retrying connection to MongoDB (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`🌐 API available at http://localhost:${PORT}/api`);
      console.log('\n🔑 Test API Endpoints:');
      console.log(`   POST   http://localhost:${PORT}/api/auth/register`);
      console.log(`   POST   http://localhost:${PORT}/api/auth/login`);
      console.log(`   GET    http://localhost:${PORT}/api/resume`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('   You can either:');
        console.log('   1. Close the application using port 5000');
        console.log(`   2. Change the PORT in your .env file`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

// Start the server
startServer();
