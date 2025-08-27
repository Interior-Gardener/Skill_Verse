const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const flash = require('connect-flash');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet'); // Added Helmet for security headers

require('dotenv').config();

// Create the express app
const app = express();

// Connect to MongoDB
connectDB();

// Passport configuration (import passport.js)
require('./config/passport');

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Added support for JSON requests
app.use(express.static('public')); // Static files served from 'public' directory
app.use('/uploads', express.static('uploads'));

// Added security headers with Helmet
app.use(helmet());

// Create necessary directories if they don't exist
const uploadDir = path.join(__dirname, 'uploads');
const profilePictureDir = path.join(uploadDir, 'profile_pictures');
const courseThumbnailDir = path.join(uploadDir, 'course_thumbnails');
const courseMaterialsDir = path.join(uploadDir, 'course_materials');

// Create directories for profile pictures, course thumbnails, and materials if they don't exist
[profilePictureDir, courseThumbnailDir, courseMaterialsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Express session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', // Use environment variable for security
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/yourDatabase', // Use environment variable or default to local MongoDB
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60 // Optional: Time-to-live for sessions (14 days)
    })
}));

// Use flash messages middleware
app.use(flash());

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', require('./routes/authRoutes'));
app.use('/', require('./routes/homeRoutes'));
app.use('/', require('./routes/profileRoutes'));
app.use('/', require('./routes/courseRoutes'));



// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
